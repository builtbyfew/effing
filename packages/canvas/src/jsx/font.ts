import { GlobalFonts } from "@napi-rs/canvas";

import type { FontData } from "../types.ts";
import { parseFontMetrics } from "./font-metrics.ts";
import type { FontMetrics } from "./font-metrics.ts";

// @napi-rs/canvas caches the typefaces Skia picks for each ctx.font (family
// list + weight + style) for the lifetime of the process and does not
// invalidate that cache when a font is registered later
// (https://github.com/Brooooooklyn/canvas/issues/1329). A lookup made before
// the matching face is registered is therefore pinned to whatever face was
// closest at the time, and nothing registered afterwards can change that. We
// can't fix that from here, but we can warn about the lookups we make
// ourselves — see noteFontLookup().
const UPSTREAM_ISSUE = "https://github.com/Brooooooklyn/canvas/issues/1329";

const registeredFonts = new Set<string>();
const metricsCache = new Map<string, FontMetrics>();
// family:weight:style keys that have been looked up through this package
const lookedUpFonts = new Set<string>();
// fontFamily|weight|style combinations already processed by noteFontLookup
const notedLookups = new Set<string>();
// keys already warned about for having no registered face
const warnedMissingFaces = new Set<string>();

/**
 * Reset internal font state (test-only).
 */
export function _resetForTest(): void {
  registeredFonts.clear();
  metricsCache.clear();
  lookedUpFonts.clear();
  notedLookups.clear();
  warnedMissingFaces.clear();
}

function normalizeWeight(weight: number | string): number | string {
  if (typeof weight === "number") return weight;
  if (weight === "normal") return 400;
  if (weight === "bold") return 700;
  const n = Number(weight);
  return Number.isNaN(n) ? weight : n;
}

function fontKey(name: string, weight: number | string, style: string): string {
  return `${name}:${normalizeWeight(weight)}:${style}`;
}

/** Split a CSS font-family list into unquoted family names. */
function splitFamilies(fontFamily: string): string[] {
  return fontFamily
    .split(",")
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ""))
    .filter((f) => f.length > 0);
}

/** Registered `weight style` pairs for a family, e.g. `["400 normal", "700 normal"]`. */
function registeredFaces(name: string): string[] {
  const prefix = `${name}:`;
  const faces: string[] = [];
  for (const key of registeredFonts) {
    if (key.startsWith(prefix)) {
      faces.push(key.slice(prefix.length).replace(":", " "));
    }
  }
  return faces;
}

/**
 * Register a font from a FontData buffer.
 * Registration is idempotent — re-registering the same font name is a no-op.
 *
 * Register every face of a family before the first measurement or render:
 * `@napi-rs/canvas` caches the face it picks for a `ctx.font` on first lookup
 * and does not invalidate that cache when a font is registered later, so a
 * face that arrives after its family/weight/style was already looked up is
 * never used for that lookup. A warning is logged when that happens for a
 * lookup made through this package.
 *
 * @param font - Font data to register
 */
export function registerFont(font: FontData): void {
  const key = fontKey(font.name, font.weight, font.style);
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

  if (lookedUpFonts.has(key)) {
    console.warn(
      `[@effing/canvas] "${font.name}" ${font.weight} ${font.style} was ` +
        `registered after text had already been laid out with that family, ` +
        `weight and style. @napi-rs/canvas caches the face it picks for a font ` +
        `on first lookup and does not invalidate it when a font is registered ` +
        `later (${UPSTREAM_ISSUE}), so text using that font keeps the face that ` +
        `was available then for the rest of the process. Register every face ` +
        `of a family before the first measurement or render.`,
    );
  }
}

/**
 * Record a font lookup made through this package (called by `setFont` for
 * every font string it sets), so that `registerFont` can warn when a face
 * arrives after its family/weight/style was already resolved.
 *
 * Also warns, once per family/weight/style, when the requested face is not
 * registered while the family has other registered faces: `@napi-rs/canvas`
 * substitutes the closest face and keeps using it for that lookup for the
 * rest of the process, even if the missing face is registered later.
 *
 * Lookups made directly through `ctx.font` cannot be observed here.
 */
export function noteFontLookup(
  fontFamily: string,
  weight: number | string,
  style: string,
): void {
  const noted = `${fontFamily}|${weight}|${style}`;
  if (notedLookups.has(noted)) return;
  notedLookups.add(noted);

  for (const name of splitFamilies(fontFamily)) {
    const key = fontKey(name, weight, style);
    lookedUpFonts.add(key);

    if (registeredFonts.has(key) || warnedMissingFaces.has(key)) continue;
    const faces = registeredFaces(name);
    // Families we know nothing about (system fonts, registerFontFromPath)
    // may well have the face; only warn when we know they don't.
    if (faces.length === 0) continue;

    warnedMissingFaces.add(key);
    console.warn(
      `[@effing/canvas] No face registered for "${name}" ` +
        `${normalizeWeight(weight)} ${style} (registered: ${faces.join(", ")}). ` +
        `@napi-rs/canvas substitutes the closest registered face and keeps ` +
        `using it for this weight and style for the rest of the process, even ` +
        `if the missing face is registered later (${UPSTREAM_ISSUE}).`,
    );
  }
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
  for (const name of splitFamilies(family)) {
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
