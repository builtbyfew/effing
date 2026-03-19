import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ReactNode } from "react";

import type { RenderReactElementOptions } from "../types.ts";
import { drawNode } from "./draw/index.ts";
import { ensureFontsRegistered } from "./font.ts";
import { buildLayoutTree } from "./layout.ts";

/**
 * Render a React element tree to a canvas context.
 *
 * Width and height default to `ctx.canvas.width` / `ctx.canvas.height` but
 * can be overridden via `options.width` and `options.height`. This is useful
 * for HiDPI rendering where the canvas is larger than the logical layout size.
 *
 * @param ctx - Canvas 2D rendering context to draw into
 * @param element - React element tree to render
 * @param options - Rendering options (fonts, dimensions, debug mode)
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
 * const png = await canvas.encode("png");
 * ```
 *
 * @example HiDPI rendering (2x)
 * ```tsx
 * const dpr = 2;
 * const canvas = createCanvas(1080 * dpr, 1080 * dpr);
 * const ctx = canvas.getContext("2d");
 * ctx.scale(dpr, dpr);
 *
 * await renderReactElement(ctx, <MyComponent />, {
 *   fonts: [myFont],
 *   width: 1080,
 *   height: 1080,
 * });
 * ```
 */
export async function renderReactElement(
  ctx: SKRSContext2D,
  element: ReactNode,
  options: RenderReactElementOptions,
): Promise<void> {
  // Register fonts
  ensureFontsRegistered(options.fonts);

  // Get dimensions (option overrides take precedence over canvas size)
  const width = options.width ?? ctx.canvas.width;
  const height = options.height ?? ctx.canvas.height;

  // Build layout tree (Yoga)
  const emojiStyle =
    options.emoji === "none" ? undefined : (options.emoji ?? "twemoji");
  const fontFamilies = [...new Set(options.fonts.map((f) => f.name))];
  const { tree: layoutTree, imageCache } = await buildLayoutTree(
    element,
    width,
    height,
    ctx,
    !!emojiStyle,
    fontFamilies,
  );

  // Draw to canvas
  await drawNode(
    ctx,
    layoutTree,
    0,
    0,
    options.debug ?? false,
    emojiStyle,
    imageCache,
  );
}
