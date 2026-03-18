import { GlobalFonts } from "@napi-rs/canvas";

import type { FontData } from "../types.ts";
import { parseFontMetrics } from "./font-metrics.ts";
import type { FontMetrics } from "./font-metrics.ts";

const registeredFonts = new Set<string>();
const metricsCache = new Map<string, FontMetrics>();

/**
 * Reset internal font state (test-only).
 */
export function _resetForTest(): void {
  registeredFonts.clear();
  metricsCache.clear();
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

  const metrics = parseFontMetrics(font.data);
  if (metrics) {
    metricsCache.set(key, metrics);
  }

  registeredFonts.add(key);
}

/**
 * Look up cached font metrics for a given family/weight/style combination.
 * Returns the exact match if found, otherwise the first match for the family.
 */
export function getFontMetrics(
  family: string,
  weight: number | string,
  style: string,
): FontMetrics | null {
  // Try exact match first
  const exact = metricsCache.get(`${family}:${weight}:${style}`);
  if (exact) return exact;

  // Fallback: first entry matching the family name
  for (const [key, metrics] of metricsCache) {
    if (key.startsWith(`${family}:`)) return metrics;
  }

  return null;
}

/**
 * Register a font from a file path.
 *
 * @param path - Path to the font file
 * @param nameAlias - Optional font family name override
 */
export function registerFontFromPath(path: string, nameAlias?: string): void {
  GlobalFonts.registerFromPath(path, nameAlias ?? "");
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
