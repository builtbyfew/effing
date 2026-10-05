// Native paragraph layout through @effing/skia's `Paragraph`: Skia breaks,
// shapes and paints the text in one place, instead of this package measuring
// it word by word across the native boundary. The paragraph follows the CSS
// line model (every line box exactly `lineHeight` tall, baseline placed by
// half-leading from the font's hhea metrics) and paints unhinted, unsnapped
// glyphs.

import { Paragraph } from "@effing/skia/extensions";
import type {
  ParagraphLine,
  ParagraphPlaceholder,
  ParagraphStyle,
} from "@effing/skia/extensions";

import type { ComputedStyle } from "../style/compute.ts";
import { DEFAULT_FONT_FAMILY } from "../style/compute.ts";
import { isEmoji } from "../language.ts";
import { measureTrimMetrics, quoteFontFamilies } from "./measure.ts";
import type { PlacedEmoji, TextLayoutResult, TextSegment } from "./index.ts";

export type NativeParagraph = Paragraph;

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

/** CSS `word-break`, as the paragraph's `wordBreak`. */
function toWordBreak(style: ComputedStyle): ParagraphStyle["wordBreak"] {
  const { wordBreak } = style;
  return wordBreak === "break-all" || wordBreak === "keep-all"
    ? wordBreak
    : "normal";
}

/**
 * CSS `overflow-wrap`, as the paragraph's `overflowWrap`. The deprecated
 * `word-break: break-word` is `overflow-wrap: anywhere`, which breaks an
 * overlong word as `break-word` does (it only adds to min-content). The
 * legacy `word-wrap` arrives as `overflowWrap` (see `expandStyle`).
 */
function toOverflowWrap(style: ComputedStyle): ParagraphStyle["overflowWrap"] {
  const { overflowWrap, wordBreak } = style;
  return overflowWrap === "break-word" ||
    overflowWrap === "anywhere" ||
    wordBreak === "break-word"
    ? "break-word"
    : "normal";
}

// Skia treats a width of 0 as unbounded; a box with no room wraps at every
// opportunity instead.
const MIN_WIDTH = 0.01;

// A paragraph needs a font size > 0. CSS draws `font-size: 0` text as
// nothing, in line boxes of no height under `line-height: normal`.
const MIN_FONT_SIZE = 1e-3;

/**
 * Where an emoji drawn as an image sits on its line: its bottom 0.1em below
 * the baseline, as CSS `vertical-align: -0.1em`. That's where Chrome draws an
 * emoji glyph (Apple Color Emoji's 🌍 ink spans 0.115em below the baseline to
 * 0.865em above it, at any line height), and what twemoji's own stylesheet
 * gives its images.
 */
const EMOJI_DROP = 0.1;

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

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

/**
 * The text as a paragraph's content, with every emoji grapheme an inline
 * placeholder for its image.
 */
type Content = {
  items: (string | ParagraphPlaceholder)[];
  /** The emoji, in the order of their placeholders. */
  emoji: string[];
  /**
   * Maps a UTF-16 index in the paragraph's text, where a placeholder counts
   * as one unit, to one in `text`; undefined when they're the same.
   */
  toTextIndex?: (index: number) => number;
};

function splitEmoji(
  text: string,
  fontSize: number,
  letterSpacing: number,
): Content {
  const items: (string | ParagraphPlaceholder)[] = [];
  const emoji: string[] = [];
  // Paragraph index → text index, at the start of each emoji and after it.
  const marks: [number, number][] = [];
  let run = "";
  let paragraphIndex = 0;
  let textIndex = 0;
  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (!isEmoji(segment)) {
      run += segment;
      paragraphIndex += segment.length;
      textIndex += segment.length;
      continue;
    }
    if (run) items.push(run);
    run = "";
    items.push({
      // Letter spacing follows every character, an emoji too, but a
      // paragraph doesn't add it to a placeholder.
      width: Math.max(0, fontSize + letterSpacing),
      height: fontSize,
      verticalAlign: "baseline",
      baselineOffset: fontSize * (1 - EMOJI_DROP),
    });
    emoji.push(segment);
    marks.push([paragraphIndex, textIndex]);
    paragraphIndex += 1;
    textIndex += segment.length;
    marks.push([paragraphIndex, textIndex]);
  }
  if (run) items.push(run);
  if (emoji.length === 0) return { items: [text], emoji };
  return {
    items,
    emoji,
    toTextIndex: (index) => {
      // The last mark at or before `index`; text runs map one to one.
      let mark: [number, number] = [0, 0];
      for (const m of marks) {
        if (m[0] > index) break;
        mark = m;
      }
      return mark[1] + (index - mark[0]);
    },
  };
}

/**
 * Lay out already-transformed text natively: one segment per line, CSS
 * half-leading line boxes from the font's hhea metrics, an ellipsis for
 * nowrap + text-overflow and for line-clamp, and text-box-trim.
 *
 * @param lineHeight - Line box height in px, or undefined for `normal`
 * @param emojiEnabled - Whether emoji are drawn as images, each in an inline
 *   box of its own
 */
export function layoutTextNative(
  text: string,
  style: ComputedStyle,
  maxWidth: number,
  lineHeight: number | undefined,
  emojiEnabled?: boolean,
): TextLayoutResult {
  const styledFontSize = style.fontSize ?? 16;
  const fontSize = Number.isFinite(styledFontSize)
    ? Math.max(styledFontSize, MIN_FONT_SIZE)
    : 16;
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle ?? "normal";
  const letterSpacing =
    typeof style.letterSpacing === "number" &&
    Number.isFinite(style.letterSpacing)
      ? style.letterSpacing
      : 0;
  const whiteSpace = style.whiteSpace ?? "normal";
  const noWrap = whiteSpace === "nowrap" || whiteSpace === "pre";
  const lineClamp =
    style.lineClamp && style.lineClamp >= 1
      ? Math.floor(style.lineClamp)
      : undefined;
  const ellipsis =
    lineClamp !== undefined || (noWrap && style.textOverflow === "ellipsis")
      ? "…"
      : undefined;
  const width = maxWidth > 0 ? maxWidth : MIN_WIDTH;

  const content = emojiEnabled
    ? splitEmoji(text, fontSize, letterSpacing)
    : { items: [text], emoji: [] };

  // Skia keeps its own cache of shaped text, so building a paragraph for text
  // it has seen (the next frame of a video, or Yoga measuring a node again)
  // only breaks the lines anew.
  const paragraph = new Paragraph(content.items, {
    fontFamily: quoteFontFamilies(fontFamily),
    fontSize,
    fontWeight: toWeight(fontWeight),
    fontStyle: toFontStyle(fontStyle),
    letterSpacing,
    lineHeight,
    textAlign: toTextAlign(style.textAlign),
    noWrap,
    maxLines: lineClamp,
    ellipsis,
    // `pre` and `pre-wrap` keep the spaces before a line break in the line.
    keepTrailingWhitespace: whiteSpace === "pre" || whiteSpace === "pre-wrap",
    wordBreak: toWordBreak(style),
    overflowWrap: toOverflowWrap(style),
  });
  countParagraph();
  const layout = paragraph.layout(width);

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
  const toTextIndex = content.toTextIndex ?? ((index: number) => index);
  const segments: TextSegment[] = lines.map((line, i) => ({
    // A line that ends the text at a newline reports the newline as its text.
    text: text
      .slice(toTextIndex(line.startIndex), toTextIndex(line.endIndex))
      .replace(/\n/g, ""),
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

  const emoji: PlacedEmoji[] = [];
  layout.placeholders.forEach((box, i) => {
    // A placeholder that line-clamp or an ellipsis cut off has no box.
    if (!box) return;
    emoji.push({
      grapheme: content.emoji[i]!,
      x: box.x,
      y: box.y,
      size: fontSize,
      baseline: lines[box.line]!.baseline,
    });
  });

  let height = lines.length * layout.lineHeight;
  if (lineHeight === undefined) {
    // Round auto line-height boxes up so Yoga's integer rounding never clips
    // a descender. Text of no font size, laid out at MIN_FONT_SIZE, has line
    // boxes of no height, as in CSS.
    const noFontSize = Number.isFinite(styledFontSize) && styledFontSize <= 0;
    height = noFontSize ? 0 : Math.ceil(height);
  }

  let paragraphOffsetY = 0;
  const textBoxTrim = style.textBoxTrim;
  if (textBoxTrim && textBoxTrim !== "none") {
    const trim = measureTrimMetrics(
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      layout.lineHeight,
      style.textBoxEdge ?? "text",
      layout.ascent,
      layout.descent,
    );
    if (textBoxTrim === "trim-start" || textBoxTrim === "trim-both") {
      for (const seg of segments) seg.y -= trim.overTrim;
      for (const e of emoji) {
        e.y -= trim.overTrim;
        e.baseline -= trim.overTrim;
      }
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
    emoji,
  };
}
