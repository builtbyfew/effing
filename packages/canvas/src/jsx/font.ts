import { GlobalFonts } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import type { FontData } from "../types.ts";
import { parseFontMetrics } from "./font-metrics.ts";
import type { FontMetrics } from "./font-metrics.ts";
import { bumpFontGeneration, fontGenerationFamily } from "./font-lookup.ts";
import { fontString, getScratchCtx } from "./text/measure.ts";

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
 * Register every face of a family before the first measurement: `@napi-rs/canvas`
 * caches the face it picks for a `ctx.font` on first lookup and does not
 * invalidate that cache when a font is registered later. Text laid out by this
 * package is not affected (see ./font-lookup.ts), but direct
 * `ctx.measureText()`/`ctx.fillText()` calls are, and a warning is logged when
 * the family/weight/style being registered had already been looked up that way.
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
  bumpFontGeneration();

  const metrics = parseFontMetrics(font.data);
  if (metrics) {
    metricsCache.set(key, metrics);
  }

  registeredFonts.add(key);

  warnIfLookedUpBefore(font);
}

// Enough glyph variety that two faces of one family are very unlikely to
// produce identical metrics.
const PROBE_TEXT = "Hamburgefonstiv 0123456789 (95)";

function probeMetrics(
  ctx: SKRSContext2D,
  font: FontData,
  extraFamilies: string[],
): string {
  ctx.font = fontString(100, font.name, font.weight, font.style, extraFamilies);
  const m = ctx.measureText(PROBE_TEXT);
  return [
    m.width,
    m.actualBoundingBoxLeft,
    m.actualBoundingBoxRight,
    m.actualBoundingBoxAscent,
    m.actualBoundingBoxDescent,
    m.fontBoundingBoxAscent,
    m.fontBoundingBoxDescent,
  ].join(" ");
}

/**
 * Warn when the family/weight/style just registered had already been looked
 * up in this process: `@napi-rs/canvas` will keep serving the face it picked
 * back then to anything that sets `ctx.font` directly.
 *
 * Detection compares a lookup under the bare family name — the key user code
 * hits via `ctx.font` — with a lookup under the current generation key, which
 * cannot have been cached yet. They resolve to the same face unless the bare
 * key was cached before this face existed.
 */
function warnIfLookedUpBefore(font: FontData): void {
  const ctx = getScratchCtx();
  const bare = probeMetrics(ctx, font, []);
  const fresh = probeMetrics(ctx, font, [`"${fontGenerationFamily()}"`]);
  if (bare === fresh) return;

  console.warn(
    `[@effing/canvas] "${font.name}" ${font.weight} ${font.style} was registered ` +
      `after text had already been measured or drawn with that family, weight ` +
      `and style. @napi-rs/canvas caches the face it picks for a font on first ` +
      `lookup and does not invalidate it when a font is registered later, so ` +
      `ctx.measureText()/fillText() with that font will keep using the face that ` +
      `was available then for the rest of the process. Register every face of a ` +
      `family before the first measurement. Text laid out by @effing/canvas ` +
      `itself is not affected.`,
  );
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
  // CSS font-family may be a comma-separated fallback chain; try each name
  const families = family
    .split(",")
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ""));

  for (const name of families) {
    const exact = metricsCache.get(`${name}:${weight}:${style}`);
    if (exact) return exact;

    for (const [key, metrics] of metricsCache) {
      if (key.startsWith(`${name}:`)) return metrics;
    }
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
  bumpFontGeneration();
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
