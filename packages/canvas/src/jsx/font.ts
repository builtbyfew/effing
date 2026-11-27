import { GlobalFonts, type FontFaceDescriptors } from "@effing/skia";

import type { FontData } from "../types.ts";
import { weightAxisRange } from "./font-axes.ts";

/** A copy of the file registered for each name, weight and style. */
const registeredFonts = new Map<string, Buffer>();

/**
 * Register a font from a FontData buffer, with its `weight` and `style` as
 * its `@font-face` descriptors: a family's faces are matched by them. A
 * variable font (TrueType, OpenType, WOFF or WOFF2) claims its whole weight
 * axis instead of `weight` (falling back to `weight` if skia rejects the
 * range), so each weight draws its own instance.
 * Registration is idempotent: registering the same file under the same name,
 * weight and style again is a no-op. Another file under them is registered
 * too, and as the newest face it is the one drawn. Registrations are global
 * to the process, so give each file its own combination of family name,
 * weight and style.
 *
 * @param font - Font data to register
 */
export function registerFont(font: FontData): void {
  const key = `${font.name}:${font.weight}:${font.style}`;
  const buffer = Buffer.isBuffer(font.data)
    ? font.data
    : Buffer.from(font.data);
  const previous = registeredFonts.get(key);
  if (previous && sameBytes(previous, buffer)) return;

  // A face registered without descriptors counts as a normal one, so every
  // face gets its weight and style. A variable font claims its weight axis
  // (within the 1-1000 that @font-face allows), so a weight draws its own
  // instance rather than a synthesized bold.
  const range = weightAxisRange(buffer);
  const style = font.style;
  let registered = range
    ? GlobalFonts.register(buffer, font.name, {
        weight: `${clampWeight(range[0])} ${clampWeight(range[1])}`,
        style,
      })
    : null;
  registered ??= GlobalFonts.register(buffer, font.name, {
    weight: font.weight,
    style,
  });

  // A copy, so that a caller changing the buffer afterwards doesn't change it.
  if (registered) registeredFonts.set(key, Buffer.from(buffer));
}

/** Whether two buffers hold the same bytes. */
function sameBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.equals(b);
}

function clampWeight(weight: number): number {
  return Math.min(1000, Math.max(1, weight));
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
