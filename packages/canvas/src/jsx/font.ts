import { readFileSync } from "node:fs";
import { GlobalFonts } from "@effing/skia";

import type { FontData } from "../types.ts";
import {
  _resetFontMetricsForTest,
  registerFontMetrics,
} from "./font-metrics.ts";

const registeredFonts = new Set<string>();

/**
 * Reset internal font state (test-only).
 */
export function _resetForTest(): void {
  registeredFonts.clear();
  _resetFontMetricsForTest();
}

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

  GlobalFonts.register(buffer, font.name);
  registerFontMetrics(font.name, buffer);

  registeredFonts.add(key);
}

/**
 * Register a font from a file path.
 *
 * @param path - Path to the font file
 * @param nameAlias - Optional font family name override
 */
export function registerFontFromPath(path: string, nameAlias?: string): void {
  GlobalFonts.registerFromPath(path, nameAlias ?? "");
  let data: Buffer | undefined;
  try {
    data = readFileSync(path);
  } catch {
    // Skia couldn't read it either.
  }
  if (data) registerFontMetrics(nameAlias ?? "", data);
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
