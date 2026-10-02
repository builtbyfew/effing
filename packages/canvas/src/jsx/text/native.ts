// Native paragraph layout through @effing/skia's `Paragraph`: Skia breaks,
// shapes and paints the text in one place, instead of this package measuring
// it word by word across the native boundary. The paragraph follows the CSS
// line model (every line box exactly `lineHeight` tall, baseline placed by
// half-leading from the font's hhea metrics) and paints unhinted, unsnapped
// glyphs, exactly as `fillText` does under `withUnsnappedText`.

import { Paragraph } from "@effing/skia/extensions";
import type {
  ParagraphLayout,
  ParagraphLine,
  ParagraphStyle,
} from "@effing/skia/extensions";

import type { ComputedStyle } from "../style/compute.ts";
import { DEFAULT_FONT_FAMILY } from "../style/compute.ts";
import { isEmoji } from "../language.ts";
import type { FontMetrics } from "../font-metrics.ts";
import { findBreakOpportunities } from "./linebreak.ts";
import { measureTrimMetrics, quoteFontFamilies } from "./measure.ts";
import type { TextLayoutResult, TextSegment } from "./index.ts";

export type NativeParagraph = Paragraph;

/**
 * Whether the native path covers this text. The TypeScript layout remains for
 * what a paragraph can't express: `word-break: break-all`, emoji drawn as
 * images, which need a position per emoji, and trailing spaces that
 * `white-space: pre` preserves, where a paragraph lets them hang.
 */
export function canLayoutNatively(
  text: string,
  style: ComputedStyle,
  emojiEnabled?: boolean,
): boolean {
  if (style.wordBreak === "break-all") return false;
  if (style.whiteSpace === "pre" && /[ \t](?:\n|$)/.test(text)) return false;
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

// A paragraph's native memory (some 20 KB) is released by a finalizer, and
// Node only runs finalizers on a later turn of the event loop. A frame loop
// that awaits nothing but microtasks never gets there, and would grow by every
// paragraph it has built. So they are counted per turn, and a render that
// finds too many outstanding yields one turn itself.
const MAX_PENDING_PARAGRAPHS = 2000;
let pendingParagraphs = 0;
let turnWatched = false;

function countParagraph(): void {
  pendingParagraphs++;
  if (turnWatched) return;
  turnWatched = true;
  // Runs once the event loop turns, by whoever's doing.
  setImmediate(() => {
    pendingParagraphs = 0;
    turnWatched = false;
  });
}

/**
 * Give Node a turn of the event loop to release the paragraphs built so far,
 * if enough have piled up since the last one.
 */
export async function releaseParagraphs(): Promise<void> {
  if (pendingParagraphs < MAX_PENDING_PARAGRAPHS) return;
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * Whether the paragraph broke its words as CSS does. Skia breaks a word that
 * is wider than `width` to fit, which CSS does only under `break-word`;
 * otherwise (`overflow-wrap: normal`) the word overflows. And where CSS first
 * wraps before such a word and breaks it only if it still doesn't fit, Skia
 * fills the line it's on: `break-word` holds only when every line that ends
 * within a word starts with that word.
 */
function breaksWordsLikeCss(
  text: string,
  layout: ParagraphLayout,
  width: number,
  breakWord: boolean,
): boolean {
  if (!breakWord && layout.minIntrinsicWidth > width) return false;
  // Skia measures the widest word before breaking it, except when it's the
  // last word, which then counts by its broken pieces. So look for lines that
  // end where the next begins (no space between) at a point the text has no
  // break opportunity.
  let opportunities: number[] | undefined;
  const { lines } = layout;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]!;
    if (line.hardBreak || line.endIndex !== lines[i + 1]!.startIndex) continue;
    opportunities ??= findBreakOpportunities(text).map((opp) => opp.position);
    if (opportunities.includes(line.endIndex)) continue;
    if (!breakWord) return false;
    if (
      opportunities.some((pos) => pos > line.startIndex && pos < line.endIndex)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Lay out already-transformed text natively. Mirrors the TypeScript layout:
 * one segment per line, CSS half-leading line boxes from the font's hhea
 * metrics, an ellipsis for nowrap + text-overflow and for line-clamp, and
 * text-box-trim.
 *
 * Returns null when a word is wider than `maxWidth`: Skia would break it
 * mid-word, where CSS (without `overflow-wrap`) lets it overflow, as the
 * TypeScript layout does. Under `word-break: break-word`, where CSS breaks it
 * too, the paragraph is kept unless Skia broke the word on a line that holds
 * more than that word (see `breaksWordsLikeCss`).
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
  countParagraph();
  const layout = paragraph.layout(width);
  if (
    !noWrap &&
    !breaksWordsLikeCss(text, layout, width, style.wordBreak === "break-word")
  ) {
    return null;
  }

  // An empty paragraph has no lines, where CSS keeps one empty line box.
  const lines: ParagraphLine[] =
    layout.lines.length > 0
      ? layout.lines
      : [
          {
            left: 0,
            width: 0,
            // As Skia places a baseline: by half-leading in the line box.
            baseline: (layout.lineHeight + layout.ascent - layout.descent) / 2,
            startIndex: 0,
            endIndex: 0,
            hardBreak: true,
          },
        ];
  const segments: TextSegment[] = lines.map((line, i) => ({
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

  let height = lines.length * layout.lineHeight;
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
