import { Canvas } from "skia-canvas";
import type { CanvasRenderingContext2D } from "skia-canvas";
import type { ReactNode } from "react";

import { expandToTree } from "./types.ts";
import type { SkiatoriOptions } from "./types.ts";
import { registerFonts } from "./text.ts";
import { measureText } from "./text.ts";
import { computeLayout } from "./layout.ts";
import {
  renderToCanvas as renderLayoutToCanvas,
  renderToPngBuffer,
} from "./render.ts";

export type { FontData, SkiatoriOptions } from "./types.ts";
export type { ImageMap } from "./layout.ts";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

function setup(element: ReactNode, options: SkiatoriOptions) {
  const { width, height, fonts } = options;
  if (fonts && fonts.length > 0) {
    registerFonts(fonts);
  }
  const nodes = expandToTree(element);
  return { nodes, width, height };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a React/JSX element to a PNG buffer using skia-canvas.
 *
 * @example
 * ```tsx
 * const png = await pngFromSkiatori(
 *   <div style={{ fontSize: 48, color: "white", backgroundColor: "blue" }}>
 *     Hello World
 *   </div>,
 *   { width: 800, height: 600, fonts: [myFont] }
 * );
 * ```
 */
export async function pngFromSkiatori(
  element: ReactNode,
  options: SkiatoriOptions,
): Promise<Buffer> {
  const { nodes, width, height } = setup(element, options);
  const result = await computeLayout(nodes, width, height, measureText);
  return renderToPngBuffer(result.layout, width, height, result.images);
}

/**
 * Render a React/JSX element onto an existing canvas context.
 *
 * This avoids canvas allocation and PNG encoding overhead — useful when
 * you already have a canvas (e.g. reusing one across frames) or want to
 * composite skiatori output with other drawing.
 *
 * @example
 * ```ts
 * import { Canvas } from "skia-canvas";
 * const canvas = new Canvas(800, 600);
 * const ctx = canvas.getContext("2d");
 * await renderToCanvas(element, ctx, { width: 800, height: 600, fonts });
 * const png = canvas.toBufferSync("png");
 * ```
 */
export async function renderToCanvas(
  element: ReactNode,
  ctx: CanvasRenderingContext2D,
  options: SkiatoriOptions,
): Promise<void> {
  const { nodes, width, height } = setup(element, options);
  const result = await computeLayout(nodes, width, height, measureText);
  renderLayoutToCanvas(ctx, result.layout, result.images);
}

// Re-export Canvas so callers don't need to depend on skia-canvas directly
export { Canvas };
