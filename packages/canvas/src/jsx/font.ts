import { GlobalFonts, type FontFaceDescriptors } from "@effing/skia";

import type { FontData } from "../types.ts";
import { weightAxisRange } from "./font-axes.ts";

const registeredFonts = new Set<string>();

/**
 * Register a font from a FontData buffer.
 * Registration is idempotent — re-registering the same font name is a no-op.
 *
 * @param font - Font data to register
 */
export function registerFont(font: FontData): void {
  const key = `${font.name}:${font.weight}:${font.style}`;
  if (registeredFonts.has(key)) return;

  const buffer = Buffer.isBuffer(font.data)
    ? font.data
    : Buffer.from(font.data);

  // The weight and style are the face's @font-face descriptors: a family's
  // faces are matched by them, and a face registered without any counts as
  // a normal one. A variable font claims its whole weight axis, so each
  // weight draws its own instance rather than a synthesized bold.
  const range = weightAxisRange(buffer);
  const registered = GlobalFonts.register(buffer, font.name, {
    weight: range ? `${range[0]} ${range[1]}` : font.weight,
    style: font.style,
  });

  if (registered) registeredFonts.add(key);
}

/**
 * Register a font from a file path.
 *
 * @param path - Path to the font file
 * @param nameAlias - Optional font family name override
 * @param descriptors - Optional `@font-face` descriptors (`weight`, `style`,
 *   `stretch`). A family's faces are matched by them; a face registered
 *   without any counts as a normal one.
 */
export function registerFontFromPath(
  path: string,
  nameAlias?: string,
  descriptors?: FontFaceDescriptors,
): void {
  GlobalFonts.registerFromPath(path, nameAlias ?? "", descriptors);
}

/**
 * Get the list of registered font family names.
 *
 * @returns Array of font family names
 */
export function registeredFamilies(): string[] {
  return GlobalFonts.families.map((f: { family: string }) => f.family);
}

/**
 * Ensure all fonts from the given array are registered.
 * Called internally by `renderReactElement()`.
 */
export function ensureFontsRegistered(fonts: FontData[]): void {
  for (const font of fonts) {
    registerFont(font);
  }
}
