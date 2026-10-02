// Re-export canvas primitives from @effing/skia so consumers never need a
// direct dependency on it (it's a dependency of this package, which pnpm does
// not expose to the consuming project). Re-exporting also guarantees a single
// native copy:
// a Path2D from one copy of @effing/skia cannot be used with a context from
// another.
import { createCanvas as _createCanvas } from "@effing/skia";
export {
  Canvas,
  type SKRSContext2D,
  GlobalFonts,
  Image,
  ImageData,
  Path2D,
  DOMMatrix,
  DOMPoint,
  DOMRect,
  PathOp,
  FillType,
  StrokeJoin,
  StrokeCap,
} from "@effing/skia";

// loadImage is wrapped (not re-exported) so remote URLs go through the same
// fetch path as <img> sources — see ./image.ts.
export {
  loadImage,
  type ImageCache,
  type LoadImageOptions,
  type LoadImageSource,
} from "./image.ts";

// encode() needs no patching: it snapshots the canvas when called, so later
// drawing can't reach a pending encode, and the Buffer it resolves with owns
// its native memory until the Buffer itself is collected (see
// ./encode.test.ts). This used to copy the result to the JS heap, to guard
// against lifetime bugs in @napi-rs/canvas's async encode that were fixed
// upstream (napi-rs/canvas#1314, #1323) before @effing/skia was forked.
export function createCanvas(width: number, height: number) {
  return _createCanvas(width, height);
}

// Lottie API
export { LottieAnimation, loadLottie, renderLottieFrame } from "./lottie.ts";

// JSX API
export { renderReactElement } from "./jsx/index.ts";

// Font management
export {
  registerFont,
  registerFontFromPath,
  registeredFamilies,
} from "./jsx/font.ts";

// Fit text
export {
  findLargestUsableFontSize,
  type FindLargestUsableFontSizeOptions,
} from "./fit-text.ts";

// Types
export type {
  FontData,
  RenderReactElementOptions,
  EmojiStyle,
} from "./types.ts";
