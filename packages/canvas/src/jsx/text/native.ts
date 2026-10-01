// Native paragraph layout through @effing/skia's `Paragraph`: Skia breaks,
// shapes and paints the text in one place, instead of this package measuring
// it word by word across the native boundary. The paragraph follows the CSS
// line model (every line box exactly `lineHeight` tall, baseline placed by
// half-leading from the font's hhea metrics) and paints unhinted, unsnapped
// glyphs, exactly as `fillText` does under `withUnsnappedText`.

import { Paragraph } from "@effing/skia/extensions";
import type { ParagraphStyle } from "@effing/skia/extensions";

import type { ComputedStyle } from "../style/compute.ts";
import { DEFAULT_FONT_FAMILY } from "../style/compute.ts";
import { isEmoji } from "../language.ts";
import type { FontMetrics } from "../font-metrics.ts";
import { measureTrimMetrics, quoteFontFamilies } from "./measure.ts";
import type { TextLayoutResult, TextSegment } from "./index.ts";

export type NativeParagraph = Paragraph;

/**
 * Whether the native path covers this text. The TypeScript layout remains for
 * what a paragraph can't express: `word-break: break-all`, and emoji drawn as
 * images, which need a position per emoji.
 */
export function canLayoutNatively(
  text: string,
  style: ComputedStyle,
  emojiEnabled?: boolean,
): boolean {
  // An empty paragraph has no lines; the TypeScript layout keeps one empty
  // line box for it.
  if (text === "") return false;
  if (style.wordBreak === "break-all") return false;
  if (emojiEnabled) {
    for (const char of text) {
      if (isEmoji(char)) return false;
    }
  }
  return true;
}

function toWeight(weight: number | string | undefined): number {
  if (typeof weight === "number") return weight;
  if (weight === "bold") return 700;
  const parsed = parseInt(String(weight ?? "400"), 10);
  return isNaN(parsed) ? 400 : parsed;
}

function toFontStyle(
  fontStyle: string | undefined,
): ParagraphStyle["fontStyle"] {
  if (fontStyle?.startsWith("italic")) return "italic";
  if (fontStyle?.startsWith("oblique")) return "oblique";
  return "normal";
}

const TEXT_ALIGNS = new Set([
  "left",
  "right",
  "center",
  "justify",
  "start",
  "end",
]);

function toTextAlign(
  textAlign: string | undefined,
): ParagraphStyle["textAlign"] {
  return textAlign !== undefined && TEXT_ALIGNS.has(textAlign)
    ? (textAlign as ParagraphStyle["textAlign"])
    : "left";
}

// Skia treats a width of 0 as unbounded; a box with no room wraps at every
// opportunity instead.
const MIN_WIDTH = 0.01;

/**
 * Lay out already-transformed text natively. Mirrors the TypeScript layout:
 * one segment per line, CSS half-leading line boxes from the font's hhea
 * metrics, an ellipsis for nowrap + text-overflow and for line-clamp, and
 * text-box-trim.
 *
 * Returns null when a word is wider than `maxWidth`: Skia would break it
 * mid-word, where CSS (without `overflow-wrap`) lets it overflow, as the
 * TypeScript layout does.
 *
 * @param lineHeight - Line box height in px, or undefined for `normal`
 */
export function layoutTextNative(
  text: string,
  style: ComputedStyle,
  maxWidth: number,
  lineHeight: number | undefined,
): TextLayoutResult | null {
  const fontSize = style.fontSize ?? 16;
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle ?? "normal";
  const letterSpacing =
    typeof style.letterSpacing === "number" ? style.letterSpacing : 0;
  const whiteSpace = style.whiteSpace ?? "normal";
  const noWrap = whiteSpace === "nowrap" || whiteSpace === "pre";
  const lineClamp =
    style.lineClamp && style.lineClamp > 0 ? style.lineClamp : undefined;
  const ellipsis =
    lineClamp !== undefined || (noWrap && style.textOverflow === "ellipsis")
      ? "…"
      : undefined;
  const width = maxWidth > 0 ? maxWidth : MIN_WIDTH;

  // Skia keeps its own cache of shaped text, so building a paragraph for text
  // it has seen (the next frame of a video, or Yoga measuring a node again)
  // only breaks the lines anew.
  const paragraph = new Paragraph(text, {
    fontFamily: quoteFontFamilies(fontFamily),
    fontSize,
    fontWeight: toWeight(fontWeight),
    fontStyle: toFontStyle(fontStyle),
    letterSpacing,
    lineHeight: lineHeight ?? 0,
    textAlign: toTextAlign(style.textAlign),
    noWrap,
    maxLines: lineClamp,
    ellipsis,
  });
  const layout = paragraph.layout(width);
  if (!noWrap && layout.minIntrinsicWidth > width) return null;

  const segments: TextSegment[] = layout.lines.map((line, i) => ({
    // A line that ends the text at a newline reports the newline as its text.
    text: text.slice(line.startIndex, line.endIndex).replace(/\n/g, ""),
    x: line.left,
    y: line.baseline,
    width: line.width,
    height: layout.lineHeight,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    color: style.color ?? "black",
    ascent: layout.ascent,
    textDecoration: style.textDecoration,
    letterSpacing,
    lineIndex: i,
  }));

  let height = layout.height;
  // As in the TypeScript layout: round auto line-height boxes up so Yoga's
  // integer rounding never clips a descender.
  if (lineHeight === undefined && segments.length > 0) {
    height = Math.ceil(height);
  }

  let paragraphOffsetY = 0;
  const textBoxTrim = style.textBoxTrim;
  if (textBoxTrim && textBoxTrim !== "none" && segments.length > 0) {
    // Express the hhea metrics as a font of unitsPerEm = fontSize, so they
    // convert back to the same px.
    const fontMetrics: FontMetrics = {
      unitsPerEm: fontSize,
      ascender: layout.ascent,
      descender: -layout.descent,
    };
    const trim = measureTrimMetrics(
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      layout.lineHeight,
      style.textBoxEdge ?? "text",
      undefined,
      fontMetrics,
    );
    if (textBoxTrim === "trim-start" || textBoxTrim === "trim-both") {
      for (const seg of segments) seg.y -= trim.overTrim;
      height -= trim.overTrim;
      paragraphOffsetY = -trim.overTrim;
    }
    if (textBoxTrim === "trim-end" || textBoxTrim === "trim-both") {
      height -= trim.underTrim;
    }
  }

  return {
    segments,
    width: segments.reduce((w, s) => Math.max(w, s.width), 0),
    height,
    paragraph,
    paragraphOffsetY,
  };
}
