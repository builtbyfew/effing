// Re-export canvas primitives from @napi-rs/canvas
import { createCanvas as _createCanvas } from "@napi-rs/canvas";
export {
  Canvas,
  type SKRSContext2D,
  GlobalFonts,
  Image,
} from "@napi-rs/canvas";

// loadImage is wrapped (not re-exported) so remote URLs go through the same
// fetch path as <img> sources — see ./image.ts.
export {
  loadImage,
  type LoadImageOptions,
  type LoadImageSource,
} from "./image.ts";

export function createCanvas(width: number, height: number) {
  const canvas = _createCanvas(width, height);
  const origEncode = canvas.encode.bind(canvas);
  type Encode = typeof canvas.encode;

  // The native @napi-rs/canvas encode() returns Buffers backed by Rust/Skia
  // memory that can be freed before downstream consumers finish reading (e.g.
  // when streaming frames concurrently). We patch encode to copy the result
  // to the JS heap so the data remains valid regardless of native GC timing.
  canvas.encode = (async (...args: unknown[]) =>
    Buffer.from(await origEncode(...(args as Parameters<Encode>)))) as Encode;

  return canvas;
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
