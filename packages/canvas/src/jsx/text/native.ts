// Native paragraph layout through @effing/skia's `Paragraph`: Skia breaks,
// shapes and paints the text in one place, instead of this package measuring
// it word by word across the native boundary. The paragraph follows the CSS
// line model (every line box exactly `lineHeight` tall, baseline placed by
// half-leading from the font's hhea metrics) and paints unhinted, unsnapped
// glyphs. `line-height: normal` line boxes are Chrome's (see `normalLineBox`).

import { Paragraph } from "@effing/skia/extensions";
import type {
  ParagraphLine,
  ParagraphPlaceholder,
  ParagraphStyle,
} from "@effing/skia/extensions";

import type { ComputedStyle } from "../style/compute.ts";
import { DEFAULT_FONT_FAMILY } from "../style/compute.ts";
import { isEmoji } from "../language.ts";
import { fontGeneration } from "../font.ts";
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

/**
 * A line box's height, the baseline in it, and the font's ascent and descent
 * it's built from, in px.
 */
type LineBox = {
  lineHeight: number;
  baseline: number;
  ascent: number;
  descent: number;
};

/**
 * A `line-height: normal` line box, as Chrome lays it out on macOS (Blink's
 * `SimpleFontData::PlatformInit` and the inline layout's half-leading): the
 * font's hhea ascent, descent and line gap each rounded to whole pixels, the
 * line box their sum, and the line gap split over its top and bottom with the
 * odd pixel at the bottom. For Liberation Sans at 20px (ascent 18.1, descent
 * 4.24, line gap 0.65) that's a 23px line box with its baseline at 18px.
 *
 * The metrics are those of the first font in the family list that's
 * available, as the paragraph reports them, and only those: Chrome also
 * grows a normal line box to fit the metrics of any fallback font that draws
 * some of its text, which this doesn't (effing#181).
 *
 * Chrome on Linux and Android moves a pixel from the ascent to the descent
 * when it rounds the descent down, which puts the baseline a pixel higher
 * there; renders here are the same on every platform, and follow macOS.
 *
 * @param ascent - The font's hhea ascent in px
 * @param descent - Its hhea descent in px, positive below the baseline
 * @param lineGap - Its hhea line gap in px; a negative one counts as none
 */
export function normalLineBox(
  ascent: number,
  descent: number,
  lineGap: number,
): LineBox {
  // Rounding half up, as Skia's SkScalarRoundToScalar.
  const a = Math.round(ascent);
  const d = Math.round(descent);
  const gap = Math.round(Math.max(0, lineGap));
  return {
    lineHeight: a + d + gap,
    baseline: a + Math.floor(gap / 2),
    ascent: a,
    descent: d,
  };
}

// Normal line boxes by font and size, valid for one font generation.
const MAX_NORMAL_LINE_BOXES = 1000;
const normalLineBoxes = new Map<string, LineBox>();
let normalLineBoxesGeneration = -1;

/**
 * The `line-height: normal` line box of text in a font, from the hhea ascent,
 * descent and line gap of the font Skia's paragraph finds for it.
 */
function normalLineBoxFor(style: ParagraphStyle): LineBox {
  if (normalLineBoxesGeneration !== fontGeneration()) {
    normalLineBoxes.clear();
    normalLineBoxesGeneration = fontGeneration();
  }
  const { fontFamily, fontSize, fontWeight, fontStyle } = style;
  const key = `${fontFamily}|${fontWeight}|${fontStyle}|${fontSize}`;
  let box = normalLineBoxes.get(key);
  if (!box) {
    const probe = new Paragraph("", style);
    countParagraph();
    const { ascent, descent, lineGap } = probe.layout(0);
    box = normalLineBox(ascent, descent, lineGap);
    if (normalLineBoxes.size >= MAX_NORMAL_LINE_BOXES) normalLineBoxes.clear();
    normalLineBoxes.set(key, box);
  }
  return box;
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
      // Lines break around it as around an emoji, not an inline-block: it
      // stays with the punctuation next to it, so "Hi 🎉! ok" breaks as
      // "Hi | 🎉! | ok" and "(🎉)" stays whole, as in browsers.
      lineBreak: "emoji",
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
 * half-leading line boxes from the font's hhea metrics (Chrome's for
 * `line-height: normal`), an ellipsis for nowrap + text-overflow and for
 * line-clamp, and text-box-trim.
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
  const fontStyles = {
    fontFamily: quoteFontFamilies(fontFamily),
    fontSize,
    fontWeight: toWeight(fontWeight),
    fontStyle: toFontStyle(fontStyle),
  };
  const normal =
    lineHeight === undefined ? normalLineBoxFor(fontStyles) : undefined;
  const paragraph = new Paragraph(content.items, {
    ...fontStyles,
    letterSpacing,
    lineHeight: normal?.lineHeight ?? lineHeight,
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

  // The paragraph places each baseline by half-leading in its line box. A
  // normal line box has it where Chrome does, and the text moves there.
  const paragraphBaseline =
    (layout.lineHeight + layout.ascent - layout.descent) / 2;
  const box: LineBox = normal ?? {
    lineHeight: layout.lineHeight,
    baseline: paragraphBaseline,
    ascent: layout.ascent,
    descent: layout.descent,
  };
  const shift = box.baseline - paragraphBaseline;

  // An empty paragraph has no lines, where CSS keeps one empty line box.
  const lines: ParagraphLine[] =
    layout.lines.length > 0
      ? layout.lines
      : [
          {
            left: 0,
            width: 0,
            baseline: paragraphBaseline,
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
    y: line.baseline + shift,
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
  layout.placeholders.forEach((placed, i) => {
    // A placeholder that line-clamp or an ellipsis cut off has no box.
    if (!placed) return;
    emoji.push({
      grapheme: content.emoji[i]!,
      x: placed.x,
      y: placed.y + shift,
      size: fontSize,
      baseline: lines[placed.line]!.baseline + shift,
    });
  });

  // Normal line boxes are whole pixels tall; text of no font size, laid out
  // at MIN_FONT_SIZE, has them of no height, as in CSS.
  let height = lines.length * layout.lineHeight;

  let paragraphOffsetY = shift;
  const textBoxTrim = style.textBoxTrim;
  if (textBoxTrim && textBoxTrim !== "none") {
    const trim = measureTrimMetrics(
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      box,
      style.textBoxEdge ?? "text",
    );
    if (textBoxTrim === "trim-start" || textBoxTrim === "trim-both") {
      for (const seg of segments) seg.y -= trim.overTrim;
      for (const e of emoji) {
        e.y -= trim.overTrim;
        e.baseline -= trim.overTrim;
      }
      height -= trim.overTrim;
      paragraphOffsetY -= trim.overTrim;
    }
    if (textBoxTrim === "trim-end" || textBoxTrim === "trim-both") {
      height -= trim.underTrim;
    }
  }

  return {
    segments,
    width: segments.reduce((w, s) => Math.max(w, s.width), 0),
    height,
    maxContentWidth: layout.maxIntrinsicWidth,
    minContentWidth: layout.minIntrinsicWidth,
    paragraph,
    paragraphOffsetY,
    emoji,
  };
}
