import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ReactNode } from "react";

import type { RenderReactElementOptions } from "../types.ts";
import { drawNode } from "./draw/index.ts";
import { ensureFontsRegistered } from "./font.ts";
import { buildLayoutTree } from "./layout.ts";
import type { RenderContext } from "./context.ts";

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
 *
 * @example Custom User-Agent for remote image fetches
 * ```tsx
 * await renderReactElement(ctx, <MyComponent />, {
 *   userAgent: "my-renderer/1.0",
 * });
 * ```
 */
export async function renderReactElement(
  ctx: SKRSContext2D,
  element: ReactNode,
  options: RenderReactElementOptions = {},
): Promise<void> {
  const fonts = options.fonts ?? [];

  // Register fonts
  ensureFontsRegistered(fonts);

  // Get dimensions (option overrides take precedence over canvas size)
  const width = options.width ?? ctx.canvas.width;
  const height = options.height ?? ctx.canvas.height;

  // Per-render context: shared image cache + cross-cutting fetch/diagnostic
  // config, threaded through both the layout and draw phases.
  const renderContext: RenderContext = {
    imageCache: new Map(),
    userAgent: options.userAgent,
    debug: options.debug ?? false,
  };

  // Build layout tree (Yoga)
  const emojiStyle =
    options.emoji === "none" ? undefined : (options.emoji ?? "twemoji");
  const fontFamilies = [...new Set(fonts.map((f) => f.name))];
  const { tree: layoutTree } = await buildLayoutTree(
    element,
    width,
    height,
    ctx,
    !!emojiStyle,
    fontFamilies,
    renderContext,
  );

  // Draw to canvas
  await drawNode(ctx, layoutTree, 0, 0, renderContext, emojiStyle);
}
