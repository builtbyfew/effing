import { createCanvas } from "@effing/skia";
import type { SKRSContext2D } from "@effing/skia";
import type { ParagraphStyle } from "@effing/skia/extensions";

// Scratch canvas for measuring glyphs
let scratchCtx: SKRSContext2D | null = null;

function getScratchCtx(): SKRSContext2D {
  if (!scratchCtx) {
    scratchCtx = createCanvas(1, 1).getContext("2d");
  }
  return scratchCtx;
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

/** A font weight as a number, as text is laid out with it. */
export function toWeight(weight: number | string | undefined): number {
  if (typeof weight === "number") return weight;
  // A number as `ctx.font` reads it, so "1e3" is 1000 here too.
  const text = String(weight ?? "400")
    .trim()
    .toLowerCase();
  if (text === "bold") return 700;
  const parsed = text === "" ? NaN : Number(text);
  return Number.isFinite(parsed) ? parsed : 400;
}

/** A font style keyword, as text is laid out with it. */
export function toFontStyle(
  fontStyle: string | undefined,
): ParagraphStyle["fontStyle"] {
  if (fontStyle?.startsWith("italic")) return "italic";
  if (fontStyle?.startsWith("oblique")) return "oblique";
  return "normal";
}

/**
 * Set font properties on a canvas context, as text is laid out with them.
 *
 * `ctx.font` ignores a value it can't parse and keeps the font it had, so
 * the weight and style are normalised as layout normalises them, and the
 * weight is clamped to the range `font` accepts (1 to 1000).
 */
export function setFont(
  ctx: SKRSContext2D,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = "normal",
): void {
  const weight = toWeight(fontWeight);
  const clamped = Number.isFinite(weight)
    ? Math.min(1000, Math.max(1, weight))
    : 400;
  ctx.font = `${toFontStyle(fontStyle)} ${clamped} ${fontSize}px ${quoteFontFamilies(fontFamily)}`;
}

/**
 * Measure how many pixels to trim from the top (overTrim) and bottom
 * (underTrim) of a line box based on `text-box-edge` keywords.
 *
 * The trim amount is the distance from the line box's edge to the target
 * metric for each edge, as the `text` edge the font's ascent and descent
 * rounded to whole pixels, as the line box's half-leading takes them (so the
 * `text` edge trims a set line height's half-leading exactly, as in Chrome).
 *
 * @param line - The line box, its baseline, and the font's ascent and
 *   descent in px, rounded as the line box is built from them
 */
export function measureTrimMetrics(
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  fontStyle: string,
  line: {
    lineHeight: number;
    baseline: number;
    ascent: number;
    descent: number;
  },
  edge: string,
): { overTrim: number; underTrim: number } {
  const c = getScratchCtx();
  // Unhinted, as text is laid out and drawn.
  const measure = (text: string) => {
    setFont(c, fontSize, fontFamily, fontWeight, fontStyle);
    const previous = c.textRendering;
    c.textRendering = "geometricPrecision";
    try {
      return c.measureText(text);
    } finally {
      c.textRendering = previous;
    }
  };

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
      targetAscent = line.ascent;
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
      targetDescent = line.descent;
      break;
  }

  const overTrim = line.baseline - targetAscent;
  const underTrim = line.lineHeight - line.baseline - targetDescent;

  return {
    overTrim: Math.max(0, overTrim),
    underTrim: Math.max(0, underTrim),
  };
}
