import { GlobalFonts } from "@effing/skia";

import type { FontData } from "../types.ts";

const registeredFonts = new Set<string>();

// Fonts can be registered through `GlobalFonts` itself, which this package
// re-exports, as well as through the functions below: every method of it that
// changes the fonts is wrapped to start a new font generation. The wrappers
// and the generation live on the shared `GlobalFonts` object, so that every
// copy of this module (one per bundle, or per test file) finds and counts the
// same ones, and a change is counted once.
const FONT_MUTATORS = [
  "register",
  "registerFromPath",
  "remove",
  "removeBatch",
  "removeAll",
  "setAlias",
  "loadFontsFromDir",
  // An own method of `GlobalFonts` that its typings leave out.
  "loadSystemFonts",
] as const satisfies readonly (keyof typeof GlobalFonts | "loadSystemFonts")[];

const FONT_GENERATION = Symbol.for("@effing/canvas.fontGeneration");

type FontGeneration = { generation: number };

function trackFontChanges(): FontGeneration {
  const fonts = GlobalFonts as unknown as Record<PropertyKey, unknown>;
  const existing = fonts[FONT_GENERATION] as FontGeneration | undefined;
  if (existing) return existing;
  const state: FontGeneration = { generation: 0 };
  for (const name of FONT_MUTATORS) {
    const method = fonts[name];
    if (typeof method !== "function") continue;
    const wrapper = function (this: unknown, ...args: unknown[]): unknown {
      try {
        return method.apply(this, args);
      } finally {
        state.generation++;
      }
    };
    Object.defineProperty(wrapper, "name", { value: method.name || name });
    fonts[name] = wrapper;
  }
  Object.defineProperty(fonts, FONT_GENERATION, { value: state });
  return state;
}

const fontChanges = trackFontChanges();

/**
 * Bumped whenever the registered fonts change, which can change the font a
 * family list resolves to: a cache of anything derived from fonts keys on it.
 */
export function fontGeneration(): number {
  return fontChanges.generation;
}

/**
 * Reset internal font state (test-only).
 */
export function _resetForTest(): void {
  registeredFonts.clear();
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
