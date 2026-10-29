import { Readable } from "stream";
import { createReadStream } from "fs";
import { processMotion } from "./motion";
import { processEffects } from "./effect";
import type { FFmpegInput, FFmpegInputInfo } from "./ffmpeg";
import { FFmpegCommand, FFmpegRunner } from "./ffmpeg";
import { processTransition } from "./transition";
import type {
  EffieData,
  EffieEffect,
  EffieSources,
  EffieWebUrl,
} from "@effing/effie";
import { ffsFetch, sourceStream } from "./fetch";
import { fileURLToPath } from "url";
import { storeKeys } from "./storage";
import type { TransientStore } from "./storage";
import { HttpProxy } from "./proxy";

import { FetchError } from "./handlers/errors";

/**
 * Repeats a single-frame image input (see EffieRenderer.imageInputArgs)
 * forever, one frame per 1/fps, so whatever runs before it in the chain runs
 * once per image instead of once per output frame. The stream is endless,
 * just like a `-loop 1` input, so a trim downstream must end it.
 */
const IMAGE_LOOP_FILTER = "loop=loop=-1:size=1";

/**
 * Gives every frame of an animation (annie) input the size of its first
 * frame, and the pixel format the next filter was configured for, so a frame
 * that differs (an rgba PNG after rgb24 ones, say) can't reach filters
 * configured for the first. Animation inputs are read with
 * `-reinit_filter 0`, so FFmpeg passes such frames on instead of rebuilding
 * the filter graph. `scale` reconfigures its input side when a frame's
 * properties change, and with `eval=init` it keeps the output size it
 * computed for the first frame (a frame of another size is resized to it).
 * When a frame already has that size and format, scale passes it through.
 */
const ANIMATION_FRAME_NORMALISER = "scale=w=iw:h=ih:eval=init";

/**
 * The pixel format of a layer's frames: yuva420p, which overlay takes anyway
 * (see buildLayerFilters), or, for an opaque layer that becomes its
 * segment's base instead of being overlaid (see baseLayerIndex), yuv420p,
 * the same frames without the alpha plane.
 */
function layerFormatFilter(opaque: boolean): string {
  return `format=${opaque ? "yuv420p" : "yuva420p"}`;
}

/** Scales a layer to floor(w * scaleFactor) x floor(h * scaleFactor), min 1. */
function layerScaleFilter(scaleFactor: number): string {
  const size = (dim: "iw" | "ih") => `'max(1,trunc(${dim}*${scaleFactor}))'`;
  return `scale=w=${size("iw")}:h=${size("ih")}`;
}

/**
 * Filters that shrink an image layer by the render's scale factor, or none
 * at scale 1 (see animationChainHead for animations).
 *
 * Layers are composed at their own pixel size (overlaid at an offset, with
 * motion relative to the frame and layer size, or in pixels that
 * processMotion scales by the same factor), so a scaled render must shrink
 * every layer by the same factor as the frame. The size is truncated
 * (at least 1 px), like the frame size is.
 *
 * Bicubic scaling (FFmpeg's default) interpolates colour and alpha
 * separately, so the colour of fully transparent pixels (usually black) would
 * bleed into the edges of opaque shapes as a dark fringe. The layer is
 * therefore scaled with premultiplied alpha: the `alpha_modes` of the first
 * `format` makes FFmpeg premultiply frames with an alpha channel before
 * scaling, and the second makes it unpremultiply them again for the effects
 * and the overlay, which expect straight alpha. FFmpeg (8.1 or newer) inserts
 * these conversions while negotiating the graph, from the decoded pixel
 * format, so an image without alpha (e.g. a JPEG, or an RGB PNG) isn't
 * premultiplied: it is scaled straight from its own format, rather than
 * first converted to an alpha format at full size as an explicit
 * `premultiply` filter would. Only its scaled frame passes the (no-op)
 * unpremultiply on the way to the overlay's alpha format.
 *
 * The scale filter adjusts the SAR to keep the aspect ratio when the size
 * rounds; the setsar=1 later in the layer chain resets it.
 */
function imageScaleFilters(scaleFactor: number): string[] {
  if (scaleFactor === 1) return [];
  return [
    "format=alpha_modes=premultiplied",
    layerScaleFilter(scaleFactor),
    "format=alpha_modes=straight",
  ];
}

/**
 * The head of an animation layer's chain: the segment's trim, the filters
 * that keep every frame at the first frame's size and format (see
 * ANIMATION_FRAME_NORMALISER), and in a scaled render the layer's scale.
 *
 * At scale 1 that's the normaliser with the layer's pixel format (see
 * layerFormatFilter) as its output format, then the trim.
 *
 * In a scaled render the layer is shrunk like an image layer (see
 * imageScaleFilters), after the trim so frames past the end of the segment
 * aren't scaled, but with an explicit premultiply/unpremultiply around the
 * scale. FFmpeg's alpha mode negotiation decides once, from the first
 * frame's pixel format, whether to premultiply, and tags the scaled frames
 * as premultiplied either way: an annie whose first frame has no alpha but a
 * later one has (an rgb24 PNG, then an rgba one) would have that frame
 * scaled with straight alpha and then unpremultiplied all the same, which
 * brightens its translucent pixels. premultiply instead runs on every frame;
 * the normaliser in front of it converts each frame, whatever its format, to
 * the alpha format premultiply was configured for (planar RGB for a PNG,
 * YUV 4:4:4 for a JPEG, so chroma isn't subsampled before the scale), at the
 * first frame's size. The scale keeps its output size and format from graph
 * configuration (scale's default `eval=init`). The cost is that an annie
 * without alpha (JPEG frames) is premultiplied too, a no-op at full size.
 */
function animationChainHead(
  trim: string,
  scaleFactor: number,
  opaque: boolean,
): string[] {
  if (scaleFactor === 1) {
    return [ANIMATION_FRAME_NORMALISER, layerFormatFilter(opaque), trim];
  }
  return [
    trim,
    ANIMATION_FRAME_NORMALISER,
    "premultiply=inplace=1",
    layerScaleFilter(scaleFactor),
    "unpremultiply=inplace=1",
    // An overlaid layer is converted by the overlay.
    ...(opaque ? [layerFormatFilter(opaque)] : []),
  ];
}

/**
 * Effects that keep an opaque layer opaque and covering the frame: scroll
 * wraps the layer around, and saturation leaves alpha alone.
 */
const OPAQUE_EFFECTS = new Set<EffieEffect["type"]>([
  "scroll",
  "saturate-in",
  "saturate-out",
]);

/**
 * Frame properties for the frames of a segment's base layer (see
 * baseLayerIndex). Overlaid on the background, the segment's frames kept the
 * background's properties, and a colour background's frames carry no colour
 * space and no side data. A layer's frames do (a JPEG's colour space and ICC
 * profile, say), and the frame that reaches the encoder first decides how
 * the output is tagged, so clear them: an output that starts with a base
 * layer stays tagged (and played back) the same way.
 */
const BASE_LAYER_FRAME_PROPS =
  "setparams=colorspace=unknown,sidedata=mode=delete";

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
   * HTTP(S) URLs for video/audio inputs are routed through this proxy, so
   * Node.js handles DNS resolution (musl/Alpine) and TLS instead of FFmpeg.
   * Since FFmpeg 9.0 the bundled binary verifies TLS peers by default but its
   * mbedTLS backend has no system CA store, so https inputs opened by FFmpeg
   * directly fail certificate verification.
   *
   * When omitted, each render starts its own proxy and closes it once the
   * render ends. Pass a shared proxy to reuse one across renders, or `false`
   * to let FFmpeg open these URLs itself.
   */
  httpProxy?: HttpProxy | false;
};

export class EffieRenderer<U extends string = EffieWebUrl> {
  private effieData: EffieData<EffieSources<U>, U>;
  private ffmpegRunners = new Set<FFmpegRunner>();
  private allowLocalFiles: boolean;
  private transientStore?: TransientStore;
  private httpProxy?: HttpProxy | false;
  private ownHttpProxies = new Set<HttpProxy>();

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
    return sourceStream(src, response);
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
   * Input arguments for a static image (an image layer or background).
   *
   * The image is opened as a single frame, not looped on the input with
   * `-loop 1`, which would make FFmpeg decode the full-size image again for
   * every output frame. The filter graph repeats the decoded frame instead
   * (see IMAGE_LOOP_FILTER). `-framerate` still matters: it gives that frame
   * a duration of 1/fps, which the loop filter uses to space the repeated
   * frames, so the stream has the same timestamps a looped input had.
   */
  private imageInputArgs(): string[] {
    return ["-framerate", this.effieData.fps.toString()];
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
      // A single frame, cover-scaled once and then repeated by the background
      // chain (see buildFFmpegCommand).
      return {
        index: inputIndex,
        source: background.source,
        preArgs: this.imageInputArgs(),
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
    // Color background - use lavfi to generate. The color is interpolated
    // into a lavfi filtergraph description, so reject filtergraph
    // metacharacters here even though the schema already constrains the color
    // syntax — validation can be skipped (FFS_SKIP_VALIDATION), and this guard
    // keeps that path from turning into filtergraph injection.
    if (/[:[\];,'"\\\s=]/.test(background.color)) {
      throw new Error(
        `Invalid background color: ${JSON.stringify(background.color)}`,
      );
    }
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
      // Pin the output to limited (tv) range. Since FFmpeg 7.1 colour range is
      // negotiated separately from the pixel format: a full-range JPEG source
      // (yuvj420p) anywhere in the graph would otherwise make the whole output
      // full range, encoded as yuvj420p/pc — FFmpeg <= 6.1 always emitted
      // limited range here.
      "-color_range",
      "tv",
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
    inputIndex: number,
  ): FFmpegInput {
    let preArgs: string[] = [];
    if (layer.type === "image") {
      // A single frame, repeated by the layer chain (see buildLayerFilters).
      preArgs = this.imageInputArgs();
    } else if (layer.type === "animation") {
      preArgs = [
        // Annie frames may change pixel format (e.g. rgb24 and rgba PNGs) or
        // size mid-stream. By default FFmpeg then rebuilds the whole filter
        // graph, which restarts every chain's timing (trims, fps, padding)
        // and leaves single-frame image inputs with nothing to send. Keep the
        // graph instead and normalise the frames at the head of the layer
        // chain (see animationChainHead).
        "-reinit_filter",
        "0",
        "-f",
        "image2",
        "-framerate",
        this.effieData.fps.toString(),
      ];
    }
    return {
      index: inputIndex,
      source: layer.source,
      preArgs,
      type: layer.type,
    };
  }

  /**
   * The frame a layer's `delay`, `from` or `until` falls on: the time
   * rounded to the nearest frame of the composition. Compositions often
   * give frame times rounded (2.933 or 2.934 for frame 88 at 30 fps), and
   * even exact fractions can come out a hair off (107/30), so a time is
   * taken to mean its nearest frame rather than compared as is.
   */
  private layerFrame(seconds: number): number {
    return Math.round(seconds * this.effieData.fps);
  }

  /**
   * Whether a layer hides everything beneath it for its segment's whole
   * duration: its source is opaque (see FFmpegInputInfo) and at least
   * frame-sized, it's placed at 0:0 without motion, visible from the start
   * to the end of the segment, and its effects keep it opaque and covering
   * (see OPAQUE_EFFECTS). In a scaled render the layer shrinks by the same
   * factor as the frame (see imageScaleFilters), so it still covers it.
   */
  private coversFrame(
    segment: EffieData<EffieSources<U>, U>["segments"][0],
    layer: EffieData<EffieSources<U>, U>["segments"][0]["layers"][0],
    info: FFmpegInputInfo | undefined,
  ): boolean {
    if (!info?.opaque) return false;
    if (info.width < this.effieData.width) return false;
    if (info.height < this.effieData.height) return false;
    if (layer.motion) return false;
    if ((layer.delay ?? 0) > 0 || (layer.from ?? 0) > 0) return false;
    if ((layer.until ?? segment.duration) < segment.duration) return false;
    return (layer.effects ?? []).every((e) => OPAQUE_EFFECTS.has(e.type));
  }

  /**
   * The index of the segment's base layer, if it has one: the topmost layer
   * that covers the frame (see coversFrame). The background and the layers
   * beneath it would be invisible, so the base layer takes the background's
   * place instead of being overlaid on it, which saves converting the layer
   * to yuva420p, the background's chain, and blending every pixel of every
   * frame (at full opacity, the blend yields the layer's pixels).
   *
   * Only a colour background is replaced. Overlaid, the segment's frames
   * carry the background's colour properties, which the base layer's get
   * too (see BASE_LAYER_FRAME_PROPS) when that background is a colour. A video
   * or image background has its own colour space, range and side data,
   * which would then no longer reach the output (the encoder tags the
   * stream from its first frame) or set the colour conversion of the layers
   * above, so such a segment keeps the overlay.
   *
   * The frames are the same as the overlay's, bit for bit, when FFmpeg
   * negotiates the same colour range for the layer either way, as it does
   * for JPEG layers. Overlaid, a layer shares its range with the
   * background and the other layers it's connected to through overlays and
   * the global background's split, though, so the range can differ (an RGB
   * image in a graph with JPEG layers), and the frames then differ by the
   * rounding of the range conversion.
   */
  private baseLayerIndex(
    segment: EffieData<EffieSources<U>, U>["segments"][0],
    layerInputOffset: number,
    inputInfo: ReadonlyMap<number, FFmpegInputInfo>,
  ): number | undefined {
    const background = segment.background ?? this.effieData.background;
    if (background.type !== "color") return undefined;
    for (let l = segment.layers.length - 1; l >= 0; l--) {
      const info = inputInfo.get(layerInputOffset + l);
      if (this.coversFrame(segment, segment.layers[l], info)) return l;
    }
    return undefined;
  }

  /**
   * Builds filter chain for all layers in a segment.
   * @param segment - The segment containing layers
   * @param bgLabel - Label for the background input (e.g., "bg_seg0" or "bg_seg")
   * @param labelPrefix - Prefix for generated labels (e.g., "seg0_" or "")
   * @param layerInputOffset - Starting input index for layers
   * @param frameWidth - Frame width, used by frame-relative effects
   * @param frameHeight - Frame height, used by frame-relative effects
   * @param outputLabel - Label for the final video output
   * @param scaleFactor - Scale factor of the render, applied to every layer
   * @param baseLayer - Index of the segment's base layer (see
   *   baseLayerIndex), which replaces the background (`bgLabel` isn't used)
   *   and the layers beneath it
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
    scaleFactor: number,
    baseLayer?: number,
  ): string[] {
    const filterParts: string[] = [];
    let currentVidLabel = bgLabel;

    for (let l = baseLayer ?? 0; l < segment.layers.length; l++) {
      const inputIdx = layerInputOffset + l;
      const layerLabel = `${labelPrefix}layer${l}`;
      const layer = segment.layers[l];
      const isBase = l === baseLayer;
      const delay = layer.delay ?? 0;
      const effectChain = layer.effects
        ? processEffects(
            layer.effects,
            this.effieData.fps,
            frameWidth,
            frameHeight,
          )
        : "";
      const trim = `trim=start=0:duration=${segment.duration - delay}`;
      // An image layer is a single frame (see imageInputArgs). Scale it and
      // convert it to yuva420p while it is still one frame, then repeat it
      // ahead of the trim, which ends the endless stream at the same frame as
      // before, so the layer keeps its frame count and timestamps. Overlay
      // (format=yuv420) takes its overlay input in yuva420p, so FFmpeg
      // converts every frame to it anyway, and pinning the format here keeps
      // time-based effects (e.g. fades) running on yuva420p, as they did with
      // a looped input, rather than on the source's format (e.g. rgba for a
      // PNG). An animation starts with animationChainHead. A base layer
      // isn't overlaid: it's converted to yuv420p instead (see
      // layerFormatFilter).
      const sourceChain = [
        ...(layer.type === "image"
          ? [
              ...imageScaleFilters(scaleFactor),
              layerFormatFilter(isBase),
              IMAGE_LOOP_FILTER,
              trim,
            ]
          : animationChainHead(trim, scaleFactor, isBase)),
        ...(effectChain ? [effectChain] : []),
      ];
      if (isBase) {
        // The base layer stands in for the overlay of the layer on the
        // background: cropped to the frame at 0:0, as many frames as the
        // segment has (an animation that ends early holds its last frame,
        // as the overlay did), on the background's 1/fps timebase, and with
        // its frame properties (see BASE_LAYER_FRAME_PROPS). tpad clones
        // the last frame at the input frame rate's interval, so an
        // animation gets an fps= before it: not every source sets a frame
        // rate (an annie split into tracks has none, see buildArgs), and
        // without one the clones all share the last frame's timestamp, so
        // the trim never ends the stream.
        const fps = `fps=${this.effieData.fps}`;
        const holdLastFrame =
          layer.type === "animation"
            ? [
                fps,
                "tpad=stop=-1:stop_mode=clone",
                `trim=duration=${segment.duration}`,
              ]
            : [];
        currentVidLabel = `${labelPrefix}tmp${l}`;
        filterParts.push(
          `[${inputIdx}:v]${[
            ...sourceChain,
            `crop=${frameWidth}:${frameHeight}:0:0`,
            "setsar=1",
            "setpts=PTS-STARTPTS",
            ...holdLastFrame,
            fps,
            BASE_LAYER_FRAME_PROPS,
          ].join(",")}[${currentVidLabel}]`,
        );
        continue;
      }
      sourceChain.push("setsar=1", "setpts=PTS-STARTPTS");
      filterParts.push(
        `[${inputIdx}:v]${sourceChain.join(",")}[${layerLabel}]`,
      );
      let overlayInputLabel = layerLabel;
      if (delay > 0) {
        // Prepend `delay` seconds of transparent frames with tpad, which pads
        // the layer at its own size (a layer need not be frame-sized).
        //
        // - fps= before tpad: tpad derives the padding frames' timestamps
        //   from the input frame rate, which not every source sets.
        // - start= rather than start_duration=: the padding is `delay`
        //   rounded to whole frames by layerFrame, the same frame the
        //   overlay's enable window opens on when `from` is left to default
        //   to `delay`, so the layer never opens on a padding frame.
        // - format=yuva420p: tpad fills with an opaque colour unless the
        //   stream has an alpha plane.
        // - fps= after tpad: re-anchors the stream to a 1/fps timebase and a
        //   consistent EOF timestamp. From FFmpeg 8.0 overlay forwards the
        //   secondary input's EOF timestamp downstream as-is, and the fps=
        //   after the overlay pads or drops frames to meet it: tpad's own EOF
        //   lands one frame early (the last frame is dropped), and a
        //   1/1000000 timebase (e.g. from concat) would be read as 1/fps and
        //   duplicate frames for ~33333 s.
        // - trim last: the padding is rounded to whole frames, so a
        //   fractional delay*fps (e.g. 0.25 s at 30 fps) would otherwise
        //   push the last frame to exactly segment.duration, which the
        //   overlay forwards to the output as an extra frame.
        filterParts.push(
          `[${layerLabel}]fps=${this.effieData.fps},format=yuva420p,tpad=start=${this.layerFrame(delay)}:color=black@0,fps=${this.effieData.fps},trim=duration=${segment.duration}[delayed_${layerLabel}]`,
        );
        overlayInputLabel = `delayed_${layerLabel}`;
      }
      const overlayOutputLabel = `${labelPrefix}tmp${l}`;
      // The motion starts on a frame too: its `start` is snapped to a frame
      // and counted from the frame the content starts on (see the padding
      // above), so a motion with no `start` is active from the layer's
      // first frame. A frame's t (pts times the timebase) can come out a
      // hair below frame/fps, so the start is put a microsecond earlier,
      // which no frame can tell apart from the frame itself.
      let offset = "0:0";
      if (layer.motion) {
        const startFrame =
          this.layerFrame(delay) + this.layerFrame(layer.motion.start ?? 0);
        const start =
          startFrame === 0 ? 0 : startFrame / this.effieData.fps - 1e-6;
        offset = processMotion(
          start,
          { ...layer.motion, start: 0 },
          scaleFactor,
        );
      }
      // The layer shows on the frames from layerFrame(from) to
      // layerFrame(until), both included. The window is compared in frames
      // (t*fps) with half a frame to spare at each end, so a time that is
      // rounded (2.933 for frame 88 at 30 fps) or a hair off in floating
      // point (107/30) still lands on its frame, and a layer that hands over
      // to the next at the same frame, or at the next one, leaves no frame
      // uncovered.
      const fromFrame = this.layerFrame(layer.from ?? delay);
      const untilFrame = this.layerFrame(layer.until ?? segment.duration);
      filterParts.push(
        `[${currentVidLabel}][${overlayInputLabel}]overlay=${offset}:enable='between(t*${this.effieData.fps},${fromFrame - 0.5},${untilFrame + 0.5})',fps=${this.effieData.fps}[${overlayOutputLabel}]`,
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
    // Master-bus peak limiter. The amix below uses normalize=0 so every source
    // plays at exactly its configured volume — amix's default normalize=1
    // silently scales each input by 1/n, which halves the audio whenever global
    // and segment tracks coexist, even when a "track" is just synthesized
    // anullsrc silence. normalize=0 means the summed signal can exceed full
    // scale, so this look-ahead limiter brick-walls peaks at 0 dBFS to prevent
    // clipping. level=false disables alimiter's auto-leveling, which would
    // otherwise normalize quiet audio back up to 0 dB and defeat the configured
    // volumes; it is transparent for signal already <= 0 dBFS.
    const masterLimiter = `alimiter=limit=1:level=false`;
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
        `[general_audio][segments_audio]amix=inputs=2:duration=longest:normalize=0,${masterLimiter}[outa]`,
      );
    } else {
      filterParts.push(
        `${audioSegmentLabels.join("")}concat=n=${
          this.effieData.segments.length
        }:v=0:a=1,${masterLimiter}[outa]`,
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

    // Layer inputs:
    for (const segment of this.effieData.segments) {
      for (const layer of segment.layers) {
        inputs.push(this.buildLayerInput(layer, inputIndex));
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

    const buildFilterComplex = (
      inputInfo: ReadonlyMap<number, FFmpegInputInfo>,
    ): string => {
      let audioCounter = 0;
      let currentTime = 0;
      const firstLayerInputIdx = 1 + numSegmentBgInputs; // Global background is input 0
      let layerInputOffset = firstLayerInputIdx;
      const filterParts: string[] = [];
      const videoSegmentLabels: string[] = [];
      const audioSegmentLabels: string[] = [];

      // Shared background chain, used for both the global background and every
      // per-segment background: cover-scale + crop the source to the frame size.
      // The scale filter preserves the source's display aspect ratio by
      // adjusting the SAR whenever the scaled size rounds (e.g. 1920x1080 ->
      // 3413x1920 for a 1080x1920 frame gives SAR 10240:10239), and crop keeps
      // that SAR. Reset it to 1:1 so every segment carries the same SAR (concat
      // rejects mismatches) and the output isn't tagged with a bogus DAR.
      // An image background is a single frame (see imageInputArgs), so it is
      // cover-scaled once and only then repeated; the fps= after the loop keeps
      // the stream on the same 1/fps timebase as every other background.
      const coverFilter = `scale=${frameWidth}x${frameHeight}:force_original_aspect_ratio=increase,crop=${frameWidth}:${frameHeight},setsar=1`;
      const bgFilter = (
        background: EffieData<EffieSources<U>, U>["background"],
      ): string =>
        background.type === "image"
          ? `${coverFilter},${IMAGE_LOOP_FILTER},fps=${this.effieData.fps}`
          : `fps=${this.effieData.fps},${coverFilter}`;

      // Segments with a base layer (see baseLayerIndex) need no background.
      const baseLayers: (number | undefined)[] = [];
      let offset = firstLayerInputIdx;
      for (const segment of this.effieData.segments) {
        baseLayers.push(this.baseLayerIndex(segment, offset, inputInfo));
        offset += segment.layers.length;
      }
      const globalBgSegmentIndices: number[] = [];
      for (let i = 0; i < this.effieData.segments.length; i++) {
        if (segmentBgInputIndices[i] === null && baseLayers[i] === undefined) {
          globalBgSegmentIndices.push(i);
        }
      }
      // Split the global background into one output per segment that uses it
      // (no explicit fifo: libavfilter buffers on links itself, and the fifo
      // filter was removed in FFmpeg 7.0). split=1 is valid, so a single
      // consumer needs no special case.
      const globalBgLabels = new Map(
        globalBgSegmentIndices.map((segIdx, i) => [segIdx, `bg_split_${i}`]),
      );
      if (globalBgLabels.size > 0) {
        filterParts.push(
          `[${globalBgInputIdx}:v]${bgFilter(this.effieData.background)},split=${globalBgLabels.size}${[...globalBgLabels.values()].map((l) => `[${l}]`).join("")}`,
        );
      }

      for (let segIdx = 0; segIdx < this.effieData.segments.length; segIdx++) {
        const segment = this.effieData.segments[segIdx];

        // Determine background for this segment (segment bg overrides global bg)
        const bgLabel = `bg_seg${segIdx}`;
        if (baseLayers[segIdx] !== undefined) {
          // The base layer replaces the background.
        } else if (segment.background) {
          // Use segment background
          const segBgInputIdx = segmentBgInputIndices[segIdx]!;
          const segBgSeek =
            segment.background.type === "video"
              ? (segment.background.seek ?? 0)
              : 0;
          filterParts.push(
            `[${segBgInputIdx}:v]${bgFilter(segment.background)},trim=start=${segBgSeek}:duration=${segment.duration},setpts=PTS-STARTPTS[${bgLabel}]`,
          );
        } else {
          // Use the global background's split output for this segment; bgFilter
          // (fps/scale/crop/setsar) is already applied in the split chain.
          filterParts.push(
            `[${globalBgLabels.get(segIdx)!}]trim=start=${backgroundSeek + currentTime}:duration=${segment.duration},setpts=PTS-STARTPTS[${bgLabel}]`,
          );
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
            scaleFactor,
            baseLayers[segIdx],
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

      return filterParts.join(";");
    };
    const outputArgs = this.buildOutputArgs(outputFilename);

    // The filter graph depends on what the sources turn out to be (see
    // baseLayerIndex), so FFmpegRunner builds it once they're fetched.
    // `filterComplex` is the graph for sources nothing is known about.
    return new FFmpegCommand(
      globalArgs,
      inputs,
      buildFilterComplex(new Map()),
      outputArgs,
      buildFilterComplex,
    );
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
    // Tracked before anything is awaited, so close() stops this render even
    // before FFmpeg starts.
    const ffmpegRunner = new FFmpegRunner(ffmpegCommand);
    this.ffmpegRunners.add(ffmpegRunner);

    let ownHttpProxy: HttpProxy | undefined;
    const done = () => {
      // A consumer may destroy the output while FFmpeg still runs, and then
      // nothing reads its stdout any more, so stop it here too.
      ffmpegRunner.close();
      this.ffmpegRunners.delete(ffmpegRunner);
      if (ownHttpProxy) {
        ownHttpProxy.close();
        this.ownHttpProxies.delete(ownHttpProxy);
      }
    };

    try {
      if (this.httpProxy === undefined) {
        ownHttpProxy = new HttpProxy();
        await ownHttpProxy.start();
        this.ownHttpProxies.add(ownHttpProxy);
      }
      const httpProxy = ownHttpProxy ?? this.httpProxy;
      const urlTransformer = httpProxy
        ? (url: string) => httpProxy.transformUrl(url)
        : undefined;

      const output = await ffmpegRunner.run(
        async ({ src }) => this.fetchSource(src),
        (src) => this.resolveReference(src),
        urlTransformer,
      );
      // The output closes once FFmpeg has exited, the render failed or the
      // consumer destroyed it.
      output.once("close", done);
      return output;
    } catch (err) {
      done();
      throw err;
    }
  }

  /** Stops every render in progress. */
  close(): void {
    for (const ffmpegRunner of this.ffmpegRunners) ffmpegRunner.close();
    for (const ownHttpProxy of this.ownHttpProxies) ownHttpProxy.close();
    this.ffmpegRunners.clear();
    this.ownHttpProxies.clear();
  }
}
