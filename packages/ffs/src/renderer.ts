import { Readable } from "stream";
import { createReadStream } from "fs";
import { processMotion } from "./motion";
import { processEffects } from "./effect";
import type { FFmpegInput } from "./ffmpeg";
import { FFmpegCommand, FFmpegRunner } from "./ffmpeg";
import { processTransition } from "./transition";
import type { EffieData, EffieSources, EffieWebUrl } from "@effing/effie";
import { ffsFetch } from "./fetch";
import { fileURLToPath } from "url";
import { storeKeys } from "./storage";
import type { TransientStore } from "./storage";
import type { HttpProxy } from "./proxy";

import { FetchError } from "./handlers/errors";

export type EffieRendererOptions = {
  /**
   * Allow reading from local file paths.
   * WARNING: Only enable this for trusted internal operations.
   * Enabling this for user-provided data is a security risk.
   * @default false
   */
  allowLocalFiles?: boolean;
  /**
   * Transient store instance for source lookups.
   * If not provided, sources will be fetched directly from network.
   */
  transientStore?: TransientStore;
  /**
   * HTTP proxy for video/audio URLs.
   * When provided, HTTP(S) URLs for video/audio inputs will be routed
   * through this proxy, allowing Node.js to handle DNS resolution
   * instead of FFmpeg (useful for Alpine Linux with musl libc).
   */
  httpProxy?: HttpProxy;
};

export class EffieRenderer<U extends string = EffieWebUrl> {
  private effieData: EffieData<EffieSources<U>, U>;
  private ffmpegRunner?: FFmpegRunner;
  private allowLocalFiles: boolean;
  private transientStore?: TransientStore;
  private httpProxy?: HttpProxy;

  constructor(
    effieData: EffieData<EffieSources<U>, U>,
    options?: EffieRendererOptions,
  ) {
    this.effieData = effieData;
    this.allowLocalFiles = options?.allowLocalFiles ?? false;
    this.transientStore = options?.transientStore;
    this.httpProxy = options?.httpProxy;
  }

  private async fetchSource(src: string): Promise<Readable> {
    // src is already a resolved URL - no #ref handling needed
    // (references are resolved in FFmpegRunner via referenceResolver)

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

    // If we have a transient store, check the store first
    if (this.transientStore) {
      const cachedStream = await this.transientStore.getStream(
        storeKeys.source(src),
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
      throw new FetchError(src, response.status, response.statusText);
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
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "frag_keyframe+empty_moov+default_base_moof",
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
   * @param frameWidth - Frame width for the delay padding source
   * @param frameHeight - Frame height for the delay padding source
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
      const delay = layer.delay ?? 0;
      const effectChain = layer.effects
        ? processEffects(
            layer.effects,
            this.effieData.fps,
            frameWidth,
            frameHeight,
          )
        : "";
      filterParts.push(
        `[${inputIdx}:v]trim=start=0:duration=${segment.duration - delay},${
          effectChain ? effectChain + "," : ""
        }setsar=1,setpts=PTS-STARTPTS[${layerLabel}]`,
      );
      let overlayInputLabel = layerLabel;
      if (delay > 0) {
        // Pad the layer with transparent frames at the effie's fps. nullsrc
        // leaves Y/U/V planes uninitialised (which decode to opaque #008700
        // on JPEG-encoded layers that lack alpha) and defaults to rate=25
        // (which causes a 1-frame off-by-one when concat'd with a 30fps
        // layer). color=c=black@0 with explicit rate and yuva420p avoids both.
        filterParts.push(
          `color=c=black@0:size=${frameWidth}x${frameHeight}:duration=${delay}:rate=${this.effieData.fps},format=yuva420p,setpts=PTS-STARTPTS[null_${layerLabel}]`,
        );
        filterParts.push(
          `[null_${layerLabel}][${layerLabel}]concat=n=2:v=1:a=0[delayed_${layerLabel}]`,
        );
        overlayInputLabel = `delayed_${layerLabel}`;
      }
      const overlayOutputLabel = `${labelPrefix}tmp${l}`;
      const offset = layer.motion ? processMotion(delay, layer.motion) : "0:0";
      const fromTime = layer.from ?? delay;
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
      // Reset PTS to 0 *before* applying fades. `atrim` preserves the source
      // timestamps, so after a seek the stream's PTS starts at `audioSeek`, not
      // 0. The fade filters anchor on PTS (fade-in at start_time=0, fade-out at
      // start_time=duration-fadeOut), so running them before the reset would
      // shift both fades by `audioSeek` — starting the fade-out ~seek seconds
      // early and skipping the fade-in entirely when seek > fadeIn.
      filterParts.push(
        `[${generalAudioInputIndex}:a]atrim=start=${audioSeek}:duration=${totalDuration},asetpts=PTS-STARTPTS,${generalAudioFilter}[general_audio]`,
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
    const bgFilter = `fps=${this.effieData.fps},scale=${frameWidth}x${frameHeight}:force_original_aspect_ratio=increase,crop=${frameWidth}:${frameHeight}`;
    if (globalBgSegmentIndices.length === 1) {
      // Single segment - no split needed, just fifo
      const fifoLabel = `bg_fifo_0`;
      filterParts.push(`[${globalBgInputIdx}:v]${bgFilter},fifo[${fifoLabel}]`);
      globalBgFifoLabels.set(globalBgSegmentIndices[0], fifoLabel);
    } else if (globalBgSegmentIndices.length > 1) {
      // Multiple segments - use split + fifo
      const splitCount = globalBgSegmentIndices.length;
      const splitOutputLabels = globalBgSegmentIndices.map(
        (_, i) => `bg_split_${i}`,
      );

      filterParts.push(
        `[${globalBgInputIdx}:v]${bgFilter},split=${splitCount}${splitOutputLabels.map((l) => `[${l}]`).join("")}`,
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
          `[${segBgInputIdx}:v]fps=${this.effieData.fps},scale=${frameWidth}x${frameHeight}:force_original_aspect_ratio=increase,crop=${frameWidth}:${frameHeight},trim=start=${segBgSeek}:duration=${segment.duration},setpts=PTS-STARTPTS[${bgLabel}]`,
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
        // apad before atrim so audio shorter than the segment is padded with
        // silence — without it, concat would start the next segment's audio
        // before the current segment's video ends.
        // (concat stitches clips back-to-back by the actual stream length,
        // not the segment's video length.)
        filterParts.push(
          `[${audioInputIndex}:a]apad,atrim=start=0:duration=${realDuration},${audioFilter},asetpts=PTS-STARTPTS[aud_seg${segIdx}]`,
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
    const sharpPromise =
      scaleFactor !== 1
        ? import("sharp").catch(() => {
            throw new Error(
              "sharp is required for image scaling but is not installed. Install it with: pnpm add sharp",
            );
          })
        : null;

    return async (imageStream: Readable): Promise<Readable> => {
      if (scaleFactor === 1) return imageStream;

      const { default: sharp } = await sharpPromise!;
      const sharpTransformer = sharp();
      imageStream.on("error", (err: Error) => {
        if (!sharpTransformer.destroyed) {
          sharpTransformer.destroy(err);
        }
      });
      sharpTransformer.on("error", (err: Error) => {
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
   * Resolves a source reference to its actual URL.
   * If the source is a #reference, returns the resolved URL.
   * Otherwise, returns the source as-is.
   */
  private resolveReference(src: string): string {
    if (src.startsWith("#")) {
      const sourceName = src.slice(1);
      if (sourceName in this.effieData.sources!) {
        return this.effieData.sources![sourceName];
      }
    }
    return src;
  }

  /**
   * Renders the effie data to a video stream.
   * @param scaleFactor - Scale factor for output dimensions
   */
  async render(scaleFactor = 1): Promise<Readable> {
    const ffmpegCommand = this.buildFFmpegCommand("-", scaleFactor);
    this.ffmpegRunner = new FFmpegRunner(ffmpegCommand);

    // Create URL transformer for proxy if available
    const urlTransformer = this.httpProxy
      ? (url: string) => this.httpProxy!.transformUrl(url)
      : undefined;

    return this.ffmpegRunner.run(
      async ({ src }) => this.fetchSource(src),
      this.createImageTransformer(scaleFactor),
      (src) => this.resolveReference(src),
      urlTransformer,
    );
  }

  close(): void {
    if (this.ffmpegRunner) {
      this.ffmpegRunner.close();
    }
  }
}
