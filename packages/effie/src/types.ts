export type EffieWebUrl = EffieHttpUrl | EffieDataUrl; // [!] does not include file URLs
export type EffieHttpUrl = `http${string}`; // HTTP URL starts with http: or https:
export type EffieDataUrl = `data${string}`; // data URL starts with data:

export type EffieFileUrl = `file${string}`; // file URL starts with file:

export type EffieSources<U extends string = EffieWebUrl> = {
  [key: string]: U; // key: source name, value: URL
};

export type EffieSource<
  S extends EffieSources<U>,
  U extends string = EffieWebUrl,
> = U | `#${Extract<keyof S, string>}`; // source name

export type EffieData<
  S extends EffieSources<U>,
  U extends string = EffieWebUrl,
> = {
  width: number; // frame width
  height: number; // frame height
  fps: number; // frames per second
  cover: EffieWebUrl; // cover image has to be a direct URL
  sources?: S; // common sources, to avoid duplication
  background: EffieBackground<S, U>; // all-encompassing background
  audio?: EffieAudio<S, U>; // general soundtrack audio
  segments: EffieSegment<S, U>[]; // consecutive video segments
};

export type EffieBackground<
  S extends EffieSources<U>,
  U extends string = EffieWebUrl,
> =
  | {
      type: "image";
      source: EffieSource<S, U>;
    }
  | {
      type: "video";
      source: EffieSource<S, U>;
      seek?: number; // seek to this position in seconds
    }
  | {
      type: "color";
      color: string; // color name or [0x|#]RRGGBB[AA]
    };

export type EffieAudio<
  S extends EffieSources<U>,
  U extends string = EffieWebUrl,
> = {
  source: EffieSource<S, U>;
  volume?: number; // volume in range [0, 1]
  fadeIn?: number; // fade-in duration in seconds
  fadeOut?: number; // fade-out duration in seconds
  seek?: number; // seek to this position in seconds
};

export type EffieSegment<
  S extends EffieSources<U>,
  U extends string = EffieWebUrl,
> = {
  duration: number;
  layers: EffieLayer<S, U>[];
  background?: EffieBackground<S, U>; // overrides global background for this segment
  audio?: EffieAudio<S, U>;
  transition?: EffieTransition; // ignored on the first segment
};

export type EffieLayer<
  S extends EffieSources<U>,
  U extends string = EffieWebUrl,
> = {
  type:
    | "image" // png or jpeg
    | "animation"; // annie
  source: EffieSource<S, U>;
  delay?: number; // delay (before start) time in seconds
  from?: number; // clip from this time in seconds
  until?: number; // clip until this time in seconds
  effects?: EffieEffect[];
  motion?: EffieMotion;
};

export type EffieTransition = {
  duration: number;
} & (
  | { type: "fade"; easing?: "linear" | "ease-in" | "ease-out" }
  // Fade through color (always linear)
  | { type: "fade"; through: "black" | "white" | "grays" }
  // Barn door wipes (default: horizontal, open)
  | {
      type: "barn";
      orientation?: "horizontal" | "vertical";
      mode?: "open" | "close";
    }
  // Circle wipes (default: open)
  | { type: "circle"; mode?: "open" | "close" | "crop" }
  // Directional transitions (default: left)
  | {
      type: "wipe" | "slide" | "smooth" | "slice";
      direction?: "left" | "right" | "up" | "down";
    }
  // Zoom
  | { type: "zoom" }
  // Standalone transitions
  | { type: "dissolve" | "pixelize" | "radial" }
);

export type EffieEffect = {
  duration: number;
} & (
  | { type: "fade-in"; start: number }
  | { type: "fade-out"; start: number }
  | { type: "saturate-in"; start: number }
  | { type: "saturate-out"; start: number }
  | {
      type: "scroll";
      direction: "left" | "right" | "up" | "down";
      distance: number;
    }
);

export type EffieMotion = {
  start?: number;
  duration?: number;
} & (
  | { type: "bounce"; amplitude?: number }
  | { type: "shake"; intensity?: number; frequency?: number }
  | {
      type: "slide";
      direction: "left" | "right" | "up" | "down";
      distance?: number;
      reverse?: boolean;
      easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    }
);

export function effieWebUrl(url: string) {
  if (url.startsWith("http") || url.startsWith("data")) {
    return url as EffieWebUrl;
  }
  throw new Error(`Invalid web URL: ${url}`);
}

export function effieFileUrl(url: string) {
  if (url.startsWith("file")) {
    return url as EffieFileUrl;
  }
  throw new Error(`Invalid file URL: ${url}`);
}

/**
 * Identity helper that returns its argument with sharper TypeScript inference
 * for `EffieData` — especially the `#ref` literal types derived from `sources`.
 * No runtime validation is performed.
 *
 * For the full Effie format reference — units, ranges, defaults, the
 * `EffieBackground` / `EffieAudio` / `EffieSegment` / `EffieLayer` /
 * `EffieTransition` / `EffieEffect` / `EffieMotion` variants, source `#refs`,
 * and runtime-enforced constraints — see the `@effing/effie` README.
 *
 * For runtime validation, use `effieDataSchema.safeParse(...)` from this same
 * package (zod is an optional peer dependency).
 */
export function effieData<S extends EffieSources>(data: EffieData<S>) {
  return data; // just for typing convenience
}

export function effieBackground<S extends EffieSources>(
  background: EffieBackground<S>,
) {
  return background; // just for typing convenience
}

/**
 * Identity helper that returns its argument with sharper TypeScript inference
 * for an `EffieSegment` — handy when building segments separately from the
 * enclosing `EffieData`. No runtime validation is performed.
 *
 * For segment semantics (duration, layer stacking, per-segment background and
 * audio overrides, transitions and the rule that the first segment's
 * transition is ignored) and the full Effie format reference, see the
 * `@effing/effie` README. For runtime validation, use `effieSegmentSchema` or
 * the top-level `effieDataSchema`.
 */
export function effieSegment<S extends EffieSources>(segment: EffieSegment<S>) {
  return segment; // just for typing convenience
}

export function effieLayer<S extends EffieSources>(layer: EffieLayer<S>) {
  return layer; // just for typing convenience
}
