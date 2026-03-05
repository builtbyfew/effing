import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ReactNode } from "react";

import type { RenderReactElementOptions } from "../types.ts";
import { drawNode } from "./draw/index.ts";
import { ensureFontsRegistered } from "./font.ts";
import { buildLayoutTree } from "./layout.ts";

/**
 * Render a React element tree to a canvas context.
 *
 * Width and height are taken from the canvas itself (`ctx.canvas.width` /
 * `ctx.canvas.height`).
 *
 * @param ctx - Canvas 2D rendering context to draw into
 * @param element - React element tree to render
 * @param options - Rendering options (fonts, debug mode)
 *
 * @example
 * ```tsx
 * import { createCanvas, renderReactElement } from "@effing/canvas";
 *
 * const canvas = createCanvas(1080, 1080);
 * const ctx = canvas.getContext("2d");
 *
 * await renderReactElement(ctx, <MyComponent />, { fonts: [myFont] });
 *
 * const png = canvas.encodeSync("png");
 * ```
 */
export async function renderReactElement(
  ctx: SKRSContext2D,
  element: ReactNode,
  options: RenderReactElementOptions,
): Promise<void> {
  // Register fonts
  ensureFontsRegistered(options.fonts);

  // Get dimensions from canvas
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Build layout tree (Yoga)
  const emojiStyle =
    options.emoji === "none" ? undefined : (options.emoji ?? "twemoji");
  const layoutTree = buildLayoutTree(element, width, height, ctx, !!emojiStyle);

  // Draw to canvas
  await drawNode(ctx, layoutTree, 0, 0, options.debug ?? false, emojiStyle);
}
