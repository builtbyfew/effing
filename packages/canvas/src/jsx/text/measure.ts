import { createCanvas } from "@effing/skia";
import type { SKRSContext2D } from "@effing/skia";

import { fontMetricsToPx } from "../font-metrics.ts";
import type { FontMetrics } from "../font-metrics.ts";

export type TextMetrics = {
  width: number;
  ascent: number;
  descent: number;
  height: number;
};

// Scratch canvas for text measurement when no ctx is available
let scratchCtx: SKRSContext2D | null = null;

function getScratchCtx(): SKRSContext2D {
  if (!scratchCtx) {
    scratchCtx = createCanvas(1, 1).getContext("2d");
  }
  return scratchCtx;
}

/**
 * Run `fn` with the context's text unhinted and unsnapped.
 *
 * Under `textRendering: "geometricPrecision"`, @effing/skia lays text out
 * unhinted and fills each glyph outline at its exact position, instead of
 * drawing hinted masks snapped to the pixel grid. Text then lands in the same
 * place at any scale, so nothing jumps while a transform animates. All text is
 * measured and drawn this way; the context's own setting is restored after.
 */
export function withUnsnappedText<T>(ctx: SKRSContext2D, fn: () => T): T {
  const previous = ctx.textRendering;
  if (previous === "geometricPrecision") return fn();
  ctx.textRendering = "geometricPrecision";
  try {
    return fn();
  } finally {
    ctx.textRendering = previous;
  }
}

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
]);

function quoteFontFamily(family: string): string {
  if (!family || GENERIC_FAMILIES.has(family)) return family;
  return `"${family}"`;
}

/** A font-family list with every non-generic family name quoted. */
export function quoteFontFamilies(fontFamily: string): string {
  return fontFamily
    .split(",")
    .map((f) => quoteFontFamily(f.trim()))
    .join(", ");
}

/**
 * Set font properties on a canvas context for measurement.
 */
export function setFont(
  ctx: SKRSContext2D,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = "normal",
): void {
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${quoteFontFamilies(fontFamily)}`;
}

/**
 * Measure text using the canvas ctx.measureText() API.
 * Returns width, ascent, descent, and total height.
 */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = "normal",
  ctx?: SKRSContext2D,
): TextMetrics {
  const c = ctx ?? getScratchCtx();
  setFont(c, fontSize, fontFamily, fontWeight, fontStyle);

  const m = withUnsnappedText(c, () => c.measureText(text));

  const ascent =
    m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? fontSize * 0.8;
  const descent =
    m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontSize * 0.2;

  return {
    width: m.width,
    ascent,
    descent,
    height: ascent + descent,
  };
}

/**
 * Measure how many pixels to trim from the top (overTrim) and bottom
 * (underTrim) of a line box based on `text-box-edge` keywords.
 *
 * The trim amount is the difference between the full line-height half-leading
 * and the target metric for each edge.
 */
export function measureTrimMetrics(
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  fontStyle: string,
  lineHeight: number,
  edge: string,
  ctx?: SKRSContext2D,
  fontMetrics?: FontMetrics | null,
): { overTrim: number; underTrim: number } {
  const c = ctx ?? getScratchCtx();
  setFont(c, fontSize, fontFamily, fontWeight, fontStyle);
  const measure = (text: string) =>
    withUnsnappedText(c, () => c.measureText(text));

  const refMetrics = measure("M");

  // When font metrics are available, use hhea ascender/descender for half-leading
  // so it stays consistent with the hhea-based line height.
  let fontAscent: number;
  let fontDescent: number;
  if (fontMetrics) {
    const px = fontMetricsToPx(fontMetrics, fontSize);
    fontAscent = px.ascent;
    fontDescent = px.descent;
  } else {
    fontAscent =
      refMetrics.fontBoundingBoxAscent ??
      refMetrics.actualBoundingBoxAscent ??
      fontSize * 0.8;
    fontDescent =
      refMetrics.fontBoundingBoxDescent ??
      refMetrics.actualBoundingBoxDescent ??
      fontSize * 0.2;
  }

  // Parse edge into over-edge and under-edge keywords
  const parts = edge.trim().split(/\s+/);
  const overEdge = parts[0] ?? "text";
  const underEdge = parts.length > 1 ? parts[1]! : overEdge;

  // Resolve over-edge keyword → target ascent
  let targetAscent: number;
  switch (overEdge) {
    case "cap": {
      const capMetrics = measure("H");
      targetAscent = capMetrics.actualBoundingBoxAscent ?? fontSize * 0.7;
      break;
    }
    case "ex": {
      const exMetrics = measure("x");
      targetAscent = exMetrics.actualBoundingBoxAscent ?? fontSize * 0.5;
      break;
    }
    case "ideographic":
    case "ideographic-ink":
    case "text":
    default:
      targetAscent = fontAscent;
      break;
  }

  // Resolve under-edge keyword → target descent
  let targetDescent: number;
  switch (underEdge) {
    case "alphabetic":
      targetDescent = 0;
      break;
    case "ideographic":
    case "ideographic-ink":
    case "text":
    default:
      targetDescent = fontDescent;
      break;
  }

  const halfLeading = (lineHeight - (fontAscent + fontDescent)) / 2;
  const overTrim = halfLeading + (fontAscent - targetAscent);
  const underTrim = halfLeading + (fontDescent - targetDescent);

  return {
    overTrim: Math.max(0, overTrim),
    underTrim: Math.max(0, underTrim),
  };
}

/**
 * Measure the width of a single word.
 */
export function measureWord(
  word: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = "normal",
  ctx?: SKRSContext2D,
  letterSpacing: number = 0,
): number {
  const base = measureText(
    word,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    ctx,
  ).width;
  if (letterSpacing === 0 || word.length === 0) return base;
  return base + letterSpacing * word.length;
}
