import type { ReactNode } from "react";

import { expandToTree } from "./types.ts";
import type { SkiatoriOptions } from "./types.ts";
import { registerFonts } from "./text.ts";
import { measureText } from "./text.ts";
import { computeLayout } from "./layout.ts";
import { renderToPngBuffer, collectImageSources } from "./render.ts";

export type { FontData, SkiatoriOptions } from "./types.ts";

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
  const { width, height, fonts } = options;

  // Register fonts
  if (fonts && fonts.length > 0) {
    registerFonts(fonts);
  }

  // Expand JSX tree to simplified element tree
  const nodes = expandToTree(element);

  // Compute layout using yoga
  const layoutTree = await computeLayout(nodes, width, height, measureText);

  // Collect all image sources for pre-loading
  const imageSources = collectImageSources(layoutTree);

  // Render to PNG
  return renderToPngBuffer(layoutTree, width, height, imageSources);
}
