import { LottieAnimation } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

export { LottieAnimation };

/**
 * Load a Lottie animation from a JSON string or Buffer.
 *
 * @param data - Lottie JSON string or Buffer
 * @param options - Optional resource path for external assets
 * @returns A `LottieAnimation` handle ready for rendering
 *
 * @example
 * ```ts
 * const anim = loadLottie(fs.readFileSync("animation.json", "utf-8"));
 * ```
 */
export function loadLottie(
  data: string | Buffer,
  options?: { resourcePath?: string },
): LottieAnimation {
  const jsonString = typeof data === "string" ? data : data.toString("utf-8");
  return LottieAnimation.loadFromData(jsonString, {
    resourcePath: options?.resourcePath,
  });
}

/**
 * Render a specific frame of a Lottie animation to a canvas context.
 *
 * Seeks the animation to the given frame, then renders it onto the
 * provided context. The canvas dimensions determine the render size.
 *
 * @param ctx - Canvas 2D rendering context to draw into
 * @param animation - Lottie animation handle (from {@link loadLottie})
 * @param frame - Zero-based frame number to render
 *
 * @example
 * ```ts
 * import { createCanvas, loadLottie, renderLottieFrame } from "@effing/canvas";
 *
 * const canvas = createCanvas(1080, 1080);
 * const ctx = canvas.getContext("2d");
 * const anim = loadLottie(jsonString);
 *
 * renderLottieFrame(ctx, anim, 0);
 * const png = canvas.encodeSync("png");
 * ```
 */
export function renderLottieFrame(
  ctx: SKRSContext2D,
  animation: LottieAnimation,
  frame: number,
): void {
  animation.seekFrame(frame);
  animation.render(ctx);
}
