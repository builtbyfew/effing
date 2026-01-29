import { Readable } from "stream";
import { createReadStream } from "fs";
import { processMotion } from "./motion";
import { processEffects } from "./effect";
import type { FFmpegInput } from "./ffmpeg";
import { FFmpegCommand, FFmpegRunner } from "./ffmpeg";
import { processTransition } from "./transition";
import type { EffieData, EffieSources, EffieWebUrl } from "@effing/effie";
import sharp from "sharp";
import { ffsFetch } from "./fetch";
import { fileURLToPath } from "url";
import { cacheKeys } from "./cache";
import type { CacheStorage } from "./cache";

export type EffieRendererOptions = {
  /**
   * Allow reading from local file paths.
   * WARNING: Only enable this for trusted internal operations.
   * Enabling this for user-provided data is a security risk.
   * @default false
   */
  allowLocalFiles?: boolean;
  /**
   * Cache storage instance for source lookups.
   * If not provided, a shared lazy-initialized cache will be used.
   */
  cacheStorage?: CacheStorage;
};

export class EffieRenderer<U extends string = EffieWebUrl> {
  private effieData: EffieData<EffieSources<U>, U>;
  private ffmpegRunner?: FFmpegRunner;
  private allowLocalFiles: boolean;
  private cacheStorage?: CacheStorage;

  constructor(
    effieData: EffieData<EffieSources<U>, U>,
    options?: EffieRendererOptions,
  ) {
    this.effieData = effieData;
    this.allowLocalFiles = options?.allowLocalFiles ?? false;
    this.cacheStorage = options?.cacheStorage;
  }

  private async fetchSource(src: string): Promise<Readable> {
    if (src.startsWith("#")) {
      const sourceName = src.slice(1);
      if (!(sourceName in this.effieData.sources!)) {
        throw new Error(`Named source "${sourceName}" not found`);
      }
      src = this.effieData.sources![sourceName];
    }

    // Handle data URLs (inline, no actual fetch or cache needed)
    if (src.startsWith("data:")) {
      const commaIndex = src.indexOf(",");
      if (commaIndex === -1) {
        throw new Error("Invalid data URL");
      }
      const meta = src.slice(5, commaIndex); // after "data:"
      const isBase64 = meta.endsWith(";base64");
      const data = src.slice(commaIndex + 1);
      const buffer = isBase64
        ? Buffer.from(data, "base64")
        : Buffer.from(decodeURIComponent(data));
      return Readable.from(buffer);
    }

    // Handle local file paths, if allowed
    if (src.startsWith("file:")) {
      if (!this.allowLocalFiles) {
        throw new Error(
          "Local file paths are not allowed. Use allowLocalFiles option for trusted operations.",
        );
      }
      return createReadStream(fileURLToPath(src));
    }

    // If we have a cache, check the cache first
    if (this.cacheStorage) {
      const cachedStream = await this.cacheStorage.getStream(
        cacheKeys.source(src),
      );
      if (cachedStream) {
        return cachedStream;
      }
    }

    // Fetch from network
    const response = await ffsFetch(src, {
      headersTimeout: 10 * 60 * 1000, // 10 minutes
      bodyTimeout: 20 * 60 * 1000, // 20 minutes
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${src}: ${response.status} ${response.statusText}`,
      );
    }
    if (!response.body) {
      throw new Error(`No body for ${src}`);
    }
    // Convert WHATWG ReadableStream to Node.js Readable
    return Readable.fromWeb(response.body);
  }

  private buildAudioFilter({
    duration,
    volume,
    fadeIn,
    fadeOut,
  }: {
    duration: number;
    volume?: number;
    fadeIn?: number;
    fadeOut?: number;
  }) {
    const filters = [];
    if (volume !== undefined) {
      filters.push(`volume=${volume}`);
    }
    if (fadeIn !== undefined) {
      filters.push(`afade=type=in:start_time=0:duration=${fadeIn}`);
    }
    if (fadeOut !== undefined) {
      filters.push(
        `afade=type=out:start_time=${duration - fadeOut}:duration=${fadeOut}`,
      );
    }
    return filters.length ? filters.join(",") : "anull";
  }

  private getFrameDimensions(scaleFactor: number) {
    // Round down to the nearest even number for H.264 compatibility
    return {
      frameWidth: Math.floor((this.effieData.width * scaleFactor) / 2) * 2,
      frameHeight: Math.floor((this.effieData.height * scaleFactor) / 2) * 2,
    };
  }

  /**
   * Builds an FFmpeg input for a background (global or segment).
   */
  private buildBackgroundInput(
    background: EffieData<EffieSources<U>, U>["background"],
    inputIndex: number,
    frameWidth: number,
    frameHeight: number,
  ): FFmpegInput {
    if (background.type === "image") {
      return {
        index: inputIndex,
        source: background.source,
        preArgs: ["-loop", "1", "-framerate", this.effieData.fps.toString()],
        type: "image",
      };
    } else if (background.type === "video") {
      return {
        index: inputIndex,
        source: background.source,
        preArgs: ["-stream_loop", "-1"],
        type: "video",
      };
    }
    // Color background - use lavfi to generate
    return {
      index: inputIndex,
      source: "",
      preArgs: [
        "-f",
        "lavfi",
        "-i",
        `color=${background.color}:size=${frameWidth}x${frameHeight}:rate=${this.effieData.fps}`,
      ],
      type: "color",
    };
  }

  private buildOutputArgs(outputFilename: string): string[] {
    return [
      "-map",
      "[outv]",
      "-map",
      "[outa]",
      "-c:v",
      "libx264",
      "-r",
      this.effieData.fps.toString(),
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "fast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-movflags",
      "frag_keyframe+empty_moov",
      "-f",
      "mp4",
      outputFilename,
    ];
  }

  private buildLayerInput(
    layer: EffieData<EffieSources<U>, U>["segments"][0]["layers"][0],
    duration: number,
    inputIndex: number,
  ): FFmpegInput {
    let preArgs: string[] = [];
    if (layer.type === "image") {
      preArgs = [
        "-loop",
        "1",
        "-t",
        duration.toString(),
        "-framerate",
        this.effieData.fps.toString(),
      ];
    } else if (layer.type === "animation") {
      preArgs = ["-f", "image2", "-framerate", this.effieData.fps.toString()];
    }
    return {
      index: inputIndex,
      source: layer.source,
      preArgs,
      type: layer.type,
    };
  }

  /**
   * Builds filter chain for all layers in a segment.
   * @param segment - The segment containing layers
   * @param bgLabel - Label for the background input (e.g., "bg_seg0" or "bg_seg")
   * @param labelPrefix - Prefix for generated labels (e.g., "seg0_" or "")
   * @param layerInputOffset - Starting input index for layers
   * @param frameWidth - Frame width for nullsrc
   * @param frameHeight - Frame height for nullsrc
   * @param outputLabel - Label for the final video output
   * @returns Array of filter parts to add to the filter chain
   */
  private buildLayerFilters(
    segment: EffieData<EffieSources<U>, U>["segments"][0],
    bgLabel: string,
    labelPrefix: string,
    layerInputOffset: number,
    frameWidth: number,
    frameHeight: number,
    outputLabel: string,
  ): string[] {
    const filterParts: string[] = [];
    let currentVidLabel = bgLabel;

    for (let l = 0; l < segment.layers.length; l++) {
      const inputIdx = layerInputOffset + l;
      const layerLabel = `${labelPrefix}layer${l}`;
      const layer = segment.layers[l];
      const effectChain = layer.effects
        ? processEffects(
            layer.effects,
            this.effieData.fps,
            frameWidth,
            frameHeight,
          )
        : "";
      filterParts.push(
        `[${inputIdx}:v]trim=start=0:duration=${segment.duration},${
          effectChain ? effectChain + "," : ""
        }setsar=1,setpts=PTS-STARTPTS[${layerLabel}]`,
      );
      let overlayInputLabel = layerLabel;
      const delay = layer.delay ?? 0;
      if (delay > 0) {
        filterParts.push(
          `nullsrc=size=${frameWidth}x${frameHeight}:duration=${delay},setpts=PTS-STARTPTS[null_${layerLabel}]`,
        );
        filterParts.push(
          `[null_${layerLabel}][${layerLabel}]concat=n=2:v=1:a=0[delayed_${layerLabel}]`,
        );
        overlayInputLabel = `delayed_${layerLabel}`;
      }
      const overlayOutputLabel = `${labelPrefix}tmp${l}`;
      const offset = layer.motion ? processMotion(delay, layer.motion) : "0:0";
      const fromTime = layer.from ?? 0;
      const untilTime = layer.until ?? segment.duration;
      filterParts.push(
        `[${currentVidLabel}][${overlayInputLabel}]overlay=${offset}:enable='between(t,${fromTime},${untilTime})',fps=${this.effieData.fps}[${overlayOutputLabel}]`,
      );
      currentVidLabel = overlayOutputLabel;
    }
    filterParts.push(`[${currentVidLabel}]null[${outputLabel}]`);

    return filterParts;
  }

  /**
   * Applies xfade/concat transitions between video segments.
   * Modifies videoSegmentLabels in place to update labels after transitions.
   * @param filterParts - Array to append filter parts to
   * @param videoSegmentLabels - Array of video segment labels (modified in place)
   */
  private applyTransitions(
    filterParts: string[],
    videoSegmentLabels: string[],
  ): void {
    let transitionOffset = 0;
    this.effieData.segments.forEach((segment, i) => {
      if (i === 0) {
        transitionOffset = segment.duration;
        return;
      }
      const combineLabel = `[vid_com${i}]`;
      if (!segment.transition) {
        transitionOffset += segment.duration;
        filterParts.push(
          `${videoSegmentLabels[i - 1]}${
            videoSegmentLabels[i]
          }concat=n=2:v=1:a=0,fps=${this.effieData.fps}${combineLabel}`,
        );
        videoSegmentLabels[i] = combineLabel;
        return;
      }
      const transitionName = processTransition(segment.transition);
      const transitionDuration = segment.transition.duration;
      transitionOffset -= transitionDuration;
      filterParts.push(
        `${videoSegmentLabels[i - 1]}${
          videoSegmentLabels[i]
        }xfade=transition=${transitionName}:duration=${transitionDuration}:offset=${transitionOffset}${combineLabel}`,
      );
      videoSegmentLabels[i] = combineLabel;
      transitionOffset += segment.duration;
    });
    filterParts.push(`${videoSegmentLabels.at(-1)}null[outv]`);
  }

  /**
   * Applies general audio mixing: concats segment audio and mixes with global audio if present.
   * @param filterParts - Array to append filter parts to
   * @param audioSegmentLabels - Array of audio segment labels to concat
   * @param totalDuration - Total duration for audio trimming
   * @param generalAudioInputIndex - Input index for general audio (if present)
   */
  private applyGeneralAudio(
    filterParts: string[],
    audioSegmentLabels: string[],
    totalDuration: number,
    generalAudioInputIndex: number,
  ): void {
    if (this.effieData.audio) {
      const audioSeek = this.effieData.audio.seek ?? 0;
      const generalAudioFilter = this.buildAudioFilter({
        duration: totalDuration,
        volume: this.effieData.audio.volume,
        fadeIn: this.effieData.audio.fadeIn,
        fadeOut: this.effieData.audio.fadeOut,
      });
      filterParts.push(
        `[${generalAudioInputIndex}:a]atrim=start=${audioSeek}:duration=${totalDuration},${generalAudioFilter},asetpts=PTS-STARTPTS[general_audio]`,
      );
      filterParts.push(
        `${audioSegmentLabels.join("")}concat=n=${
          this.effieData.segments.length
        }:v=0:a=1,atrim=start=0:duration=${totalDuration}[segments_audio]`,
      );
      filterParts.push(
        `[general_audio][segments_audio]amix=inputs=2:duration=longest[outa]`,
      );
    } else {
      filterParts.push(
        `${audioSegmentLabels.join("")}concat=n=${
          this.effieData.segments.length
        }:v=0:a=1[outa]`,
      );
    }
  }

  private buildFFmpegCommand(
    outputFilename: string,
    scaleFactor: number = 1,
  ): FFmpegCommand {
    const globalArgs: string[] = ["-y", "-loglevel", "error"];
    const inputs: FFmpegInput[] = [];
    let inputIndex = 0;

    const { frameWidth, frameHeight } = this.getFrameDimensions(scaleFactor);
    const backgroundSeek =
      this.effieData.background.type === "video"
        ? (this.effieData.background.seek ?? 0)
        : 0;

    // Global background input:
    inputs.push(
      this.buildBackgroundInput(
        this.effieData.background,
        inputIndex,
        frameWidth,
        frameHeight,
      ),
    );
    const globalBgInputIdx = inputIndex;
    inputIndex++;

    // Segment background inputs:
    const segmentBgInputIndices: (number | null)[] = [];
    for (const segment of this.effieData.segments) {
      if (segment.background) {
        inputs.push(
          this.buildBackgroundInput(
            segment.background,
            inputIndex,
            frameWidth,
            frameHeight,
          ),
        );
        segmentBgInputIndices.push(inputIndex);
        inputIndex++;
      } else {
        segmentBgInputIndices.push(null);
      }
    }

    // Identify segments using global background
    const globalBgSegmentIndices: number[] = [];
    for (let i = 0; i < this.effieData.segments.length; i++) {
      if (segmentBgInputIndices[i] === null) {
        globalBgSegmentIndices.push(i);
      }
    }

    // Layer inputs:
    for (const segment of this.effieData.segments) {
      for (const layer of segment.layers) {
        inputs.push(this.buildLayerInput(layer, segment.duration, inputIndex));
        inputIndex++;
      }
    }

    // Audio inputs:
    for (const segment of this.effieData.segments) {
      if (segment.audio) {
        inputs.push({
          index: inputIndex,
          source: segment.audio.source,
          preArgs: [],
          type: "audio",
        });
        inputIndex++;
      }
    }

    // General audio input:
    if (this.effieData.audio) {
      inputs.push({
        index: inputIndex,
        source: this.effieData.audio.source,
        preArgs: [],
        type: "audio",
      });
      inputIndex++;
    }

    // Compute how many video inputs we have:
    const numSegmentBgInputs = segmentBgInputIndices.filter(
      (i) => i !== null,
    ).length;
    const numVideoInputs =
      1 +
      numSegmentBgInputs +
      this.effieData.segments.reduce((sum, seg) => sum + seg.layers.length, 0);
    let audioCounter = 0;

    // Build filter_complex:
    let currentTime = 0;
    let layerInputOffset = 1 + numSegmentBgInputs; // Global background is input 0
    const filterParts: string[] = [];
    const videoSegmentLabels: string[] = [];
    const audioSegmentLabels: string[] = [];

    // Build split/fifo chain for global background
    const globalBgFifoLabels: Map<number, string> = new Map();
    if (globalBgSegmentIndices.length === 1) {
      // Single segment - no split needed, just fifo
      const fifoLabel = `bg_fifo_0`;
      filterParts.push(
        `[${globalBgInputIdx}:v]fps=${this.effieData.fps},scale=${frameWidth}x${frameHeight},fifo[${fifoLabel}]`,
      );
      globalBgFifoLabels.set(globalBgSegmentIndices[0], fifoLabel);
    } else if (globalBgSegmentIndices.length > 1) {
      // Multiple segments - use split + fifo
      const splitCount = globalBgSegmentIndices.length;
      const splitOutputLabels = globalBgSegmentIndices.map(
        (_, i) => `bg_split_${i}`,
      );

      filterParts.push(
        `[${globalBgInputIdx}:v]fps=${this.effieData.fps},scale=${frameWidth}x${frameHeight},split=${splitCount}${splitOutputLabels.map((l) => `[${l}]`).join("")}`,
      );

      for (let i = 0; i < splitCount; i++) {
        const fifoLabel = `bg_fifo_${i}`;
        filterParts.push(`[${splitOutputLabels[i]}]fifo[${fifoLabel}]`);
        globalBgFifoLabels.set(globalBgSegmentIndices[i], fifoLabel);
      }
    }

    for (let segIdx = 0; segIdx < this.effieData.segments.length; segIdx++) {
      const segment = this.effieData.segments[segIdx];

      // Determine background for this segment (segment bg overrides global bg)
      const bgLabel = `bg_seg${segIdx}`;
      if (segment.background) {
        // Use segment background
        const segBgInputIdx = segmentBgInputIndices[segIdx]!;
        const segBgSeek =
          segment.background.type === "video"
            ? (segment.background.seek ?? 0)
            : 0;
        filterParts.push(
          `[${segBgInputIdx}:v]fps=${this.effieData.fps},scale=${frameWidth}x${frameHeight},trim=start=${segBgSeek}:duration=${segment.duration},setpts=PTS-STARTPTS[${bgLabel}]`,
        );
      } else {
        // Use global background (via split/fifo chain)
        const fifoLabel = globalBgFifoLabels.get(segIdx);
        if (fifoLabel) {
          // fps/scale already applied in split/fifo chain
          filterParts.push(
            `[${fifoLabel}]trim=start=${backgroundSeek + currentTime}:duration=${segment.duration},setpts=PTS-STARTPTS[${bgLabel}]`,
          );
        }
      }

      // Process layers
      const vidLabel = `vid_seg${segIdx}`;
      filterParts.push(
        ...this.buildLayerFilters(
          segment,
          bgLabel,
          `seg${segIdx}_`,
          layerInputOffset,
          frameWidth,
          frameHeight,
          vidLabel,
        ),
      );
      layerInputOffset += segment.layers.length;
      videoSegmentLabels.push(`[${vidLabel}]`);

      const nextSegment = this.effieData.segments[segIdx + 1];
      const transitionDuration = nextSegment?.transition?.duration ?? 0;
      // Ensure audio duration is always at least 0.001 seconds to avoid FFmpeg misbehavior
      const realDuration = Math.max(
        0.001,
        segment.duration - transitionDuration,
      );

      // Process audio: use the corresponding audio input index if audio exists
      if (segment.audio) {
        // Audio inputs start after all video inputs
        const audioInputIndex = numVideoInputs + audioCounter;
        const audioFilter = this.buildAudioFilter({
          duration: realDuration,
          volume: segment.audio.volume,
          fadeIn: segment.audio.fadeIn,
          fadeOut: segment.audio.fadeOut,
        });
        filterParts.push(
          `[${audioInputIndex}:a]atrim=start=0:duration=${realDuration},${audioFilter},asetpts=PTS-STARTPTS[aud_seg${segIdx}]`,
        );
        audioCounter++;
      } else {
        filterParts.push(
          `anullsrc=r=44100:cl=stereo,atrim=start=0:duration=${realDuration},asetpts=PTS-STARTPTS[aud_seg${segIdx}]`,
        );
      }
      audioSegmentLabels.push(`[aud_seg${segIdx}]`);

      currentTime += realDuration;
    }

    // Add general audio if present
    this.applyGeneralAudio(
      filterParts,
      audioSegmentLabels,
      currentTime,
      numVideoInputs + audioCounter,
    );

    // Apply transitions between video segments
    this.applyTransitions(filterParts, videoSegmentLabels);

    const filterComplex = filterParts.join(";");
    const outputArgs = this.buildOutputArgs(outputFilename);

    return new FFmpegCommand(globalArgs, inputs, filterComplex, outputArgs);
  }

  private createImageTransformer(scaleFactor: number) {
    return async (imageStream: Readable): Promise<Readable> => {
      if (scaleFactor === 1) return imageStream;

      const sharpTransformer = sharp();
      imageStream.on("error", (err) => {
        if (!sharpTransformer.destroyed) {
          sharpTransformer.destroy(err);
        }
      });
      sharpTransformer.on("error", (err) => {
        if (!imageStream.destroyed) {
          imageStream.destroy(err);
        }
      });
      imageStream.pipe(sharpTransformer);
      try {
        const metadata = await sharpTransformer.metadata();
        const imageWidth = metadata.width ?? this.effieData.width;
        const imageHeight = metadata.height ?? this.effieData.height;
        return sharpTransformer.resize({
          width: Math.floor(imageWidth * scaleFactor),
          height: Math.floor(imageHeight * scaleFactor),
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (!sharpTransformer.destroyed) {
          sharpTransformer.destroy(error);
        }
        throw error;
      }
    };
  }

  /**
   * Renders the effie data to a video stream.
   * @param scaleFactor - Scale factor for output dimensions
   */
  async render(scaleFactor = 1): Promise<Readable> {
    const ffmpegCommand = this.buildFFmpegCommand("-", scaleFactor);
    this.ffmpegRunner = new FFmpegRunner(ffmpegCommand);
    return this.ffmpegRunner.run(
      async ({ src }) => this.fetchSource(src),
      this.createImageTransformer(scaleFactor),
    );
  }

  close(): void {
    if (this.ffmpegRunner) {
      this.ffmpegRunner.close();
    }
  }
}
