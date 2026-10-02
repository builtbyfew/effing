// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { SKRSContext2D } from "@effing/skia";

import type { ComputedStyle } from "../style/compute.ts";
import { DEFAULT_FONT_FAMILY, resolveUnit } from "../style/compute.ts";
import { getFontMetrics } from "../font.ts";
import { fontMetricsToPx } from "../font-metrics.ts";
import type { FontMetrics } from "../font-metrics.ts";
import { isEmoji } from "../language.ts";
import { MeasureMode } from "../yoga.ts";
import { findBreakOpportunities } from "./linebreak.ts";
import { measureText, measureTrimMetrics, measureWord } from "./measure.ts";
import type { TextMetrics } from "./measure.ts";
import { canLayoutNatively, layoutTextNative } from "./native.ts";
import type { NativeParagraph } from "./native.ts";

export type TextSegment = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  fontStyle: string;
  color: string;
  ascent: number;
  textDecoration?: string;
  letterSpacing: number;
  lineIndex: number;
  textStrokeWidth?: number;
  textStrokeColor?: string;
};

export type TextLayoutResult = {
  segments: TextSegment[];
  width: number;
  height: number;
  /**
   * Set when the text was laid out natively: the paragraph to paint instead
   * of the segments, which still describe its lines (for decorations).
   */
  paragraph?: NativeParagraph;
  /** Vertical offset to paint `paragraph` at, relative to the text box. */
  paragraphOffsetY?: number;
};

/**
 * Measure the width of a word, accounting for emoji characters when enabled.
 * Emoji characters are treated as square images sized to fontSize.
 */
function emojiAwareMeasureWord(
  word: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  fontStyle: string,
  ctx?: SKRSContext2D,
  letterSpacing: number = 0,
): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let totalWidth = 0;
  let textBuffer = "";

  for (const { segment } of segmenter.segment(word)) {
    let isEmojiSegment = false;
    for (const char of segment) {
      if (isEmoji(char)) {
        isEmojiSegment = true;
        break;
      }
    }

    if (isEmojiSegment) {
      if (textBuffer) {
        totalWidth += measureWord(
          textBuffer,
          fontSize,
          fontFamily,
          fontWeight,
          fontStyle,
          ctx,
          letterSpacing,
        );
        textBuffer = "";
      }
      totalWidth += fontSize;
    } else {
      textBuffer += segment;
    }
  }

  if (textBuffer) {
    totalWidth += measureWord(
      textBuffer,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      ctx,
      letterSpacing,
    );
  }

  return totalWidth;
}

/**
 * Lay out text content into positioned lines.
 *
 * Text is laid out natively, as one paragraph that Skia breaks and shapes
 * (see `./native.ts`), except where a paragraph can't express the result —
 * `word-break: break-all`, emoji drawn as images, a word wider than the box
 * (or, under `break-word`, a line Skia breaks such a word on before wrapping)
 * — which goes through `layoutTextFallback`.
 *
 * @param text - The text to lay out
 * @param style - Computed style
 * @param maxWidth - Maximum width for wrapping
 * @param ctx - Canvas context for measurement
 * @param emojiEnabled - Whether to use emoji-aware measurement
 * @returns Text segments with positions and total dimensions
 */
export function layoutText(
  text: string,
  style: ComputedStyle,
  maxWidth: number,
  ctx?: SKRSContext2D,
  emojiEnabled?: boolean,
): TextLayoutResult {
  const fontSize = style.fontSize ?? 16;
  const isAutoLineHeight =
    style.lineHeight === undefined || style.lineHeight === "normal";
  const lineHeight = isAutoLineHeight
    ? undefined
    : resolveLineHeight(style.lineHeight, fontSize);
  // A paragraph reads a line height of 0 as `normal`, so a line box
  // collapsed to nothing is left to the fallback.
  const hasLineBox = lineHeight === undefined || lineHeight > 0;
  if (hasLineBox && canLayoutNatively(text, style, emojiEnabled)) {
    const result = layoutTextNative(
      applyTextTransform(text, style),
      style,
      maxWidth,
      lineHeight,
    );
    if (result) {
      const textStrokeWidth = resolveTextStrokeWidth(style, fontSize);
      for (const seg of result.segments) {
        seg.textStrokeWidth = textStrokeWidth;
        seg.textStrokeColor = style.WebkitTextStrokeColor;
      }
      return result;
    }
  }
  return layoutTextFallback(text, style, maxWidth, ctx, emojiEnabled);
}

/**
 * The TypeScript layout: breaks lines by measuring the text word by word, and
 * positions each line as a segment to draw with `fillText`.
 */
export function layoutTextFallback(
  text: string,
  style: ComputedStyle,
  maxWidth: number,
  ctx?: SKRSContext2D,
  emojiEnabled?: boolean,
): TextLayoutResult {
  const fontSize = style.fontSize ?? 16;
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle ?? "normal";
  const color = style.color ?? "black";
  const textAlign = style.textAlign ?? "left";
  // Measure reference metrics for "normal" lineHeight (font ascent + descent)
  const refMetrics = measureText(
    "M",
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    ctx,
  );
  const fontMetrics = getFontMetrics(fontFamily, fontWeight, fontStyle);
  const lineHeightPx = resolveLineHeight(
    style.lineHeight,
    fontSize,
    refMetrics,
    fontMetrics,
  );
  const letterSpacing =
    typeof style.letterSpacing === "number" ? style.letterSpacing : 0;
  const whiteSpace = style.whiteSpace ?? "normal";
  const wordBreak = style.wordBreak ?? "normal";
  const textOverflow = style.textOverflow ?? "clip";
  const textDecoration = style.textDecoration;

  const textStrokeWidth = resolveTextStrokeWidth(style, fontSize);
  const textStrokeColor = style.WebkitTextStrokeColor;

  // Choose measurement function based on emoji mode
  const measure = emojiEnabled
    ? (word: string, ls?: number) =>
        emojiAwareMeasureWord(
          word,
          fontSize,
          fontFamily,
          fontWeight,
          fontStyle,
          ctx,
          ls ?? letterSpacing,
        )
    : (word: string, ls?: number) =>
        measureWord(
          word,
          fontSize,
          fontFamily,
          fontWeight,
          fontStyle,
          ctx,
          ls ?? letterSpacing,
        );

  const processedText = applyTextTransform(text, style);

  const noWrap = whiteSpace === "nowrap" || whiteSpace === "pre";

  // Split by explicit newlines
  const paragraphs = processedText.split("\n");

  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (noWrap) {
      lines.push(paragraph);
      continue;
    }

    // Wrap text
    const wrapped = wrapText(paragraph, maxWidth, wordBreak, measure);
    lines.push(...wrapped);
  }

  // Handle text-overflow: ellipsis
  if (textOverflow === "ellipsis" && noWrap && lines.length === 1) {
    const line = lines[0]!;
    const lineWidth = measure(line);
    if (lineWidth > maxWidth) {
      lines[0] = truncateWithEllipsis(
        line,
        maxWidth,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        ctx,
        letterSpacing,
      );
    }
  }

  // Handle lineClamp: truncate to N lines with ellipsis on last visible line.
  // Rejoin all text from the last visible line onward so the truncation can
  // fill the last line with as much text as possible (instead of being limited
  // to what the word-wrapping placed on that line alone).
  const lineClamp = style.lineClamp;
  if (lineClamp && lineClamp > 0 && lines.length > lineClamp) {
    const lastLineText = lines.slice(lineClamp - 1).join(" ");
    lines.length = lineClamp;
    lines[lineClamp - 1] = truncateWithEllipsis(
      lastLineText,
      maxWidth,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      ctx,
      letterSpacing,
    );
  }

  // Create positioned segments
  const segments: TextSegment[] = [];
  let totalHeight = 0;
  let maxLineWidth = 0;
  const isAutoLineHeight =
    style.lineHeight === undefined || style.lineHeight === "normal";
  // When font metrics are available, derive positioning ascent/descent from
  // hhea values so baseline placement is consistent with the hhea-based
  // line-height. Canvas fontBoundingBox metrics can differ from hhea values,
  // and mixing the two shifts the baseline. Satori uses hhea for both.
  const fontPx = fontMetrics ? fontMetricsToPx(fontMetrics, fontSize) : null;
  let lastPositioningDescent: number | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineWidth = measure(line);

    // A line wider than the box is start-aligned and overflows the end edge,
    // as in CSS, whatever the alignment (and as a native paragraph does).
    const slack = Math.max(0, maxWidth - lineWidth);
    let x = 0;
    if (textAlign === "center") {
      x = slack / 2;
    } else if (textAlign === "right") {
      x = slack;
    }

    const metrics = measureText(
      line || "M",
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      ctx,
    );

    const positioningAscent = fontPx?.ascent ?? metrics.ascent;
    const positioningDescent = fontPx?.descent ?? metrics.descent;
    lastPositioningDescent = positioningDescent;

    // When line-height is "normal" and font content area exceeds the
    // hhea-based line-height, scale both proportionally so half-leading
    // becomes 0 and text stays within the line box. For explicit tight
    // lineHeight values the overflow is intentional (standard CSS half-leading).
    const contentHeight = positioningAscent + positioningDescent;
    let effectiveAscent = positioningAscent;
    let effectiveDescent = positioningDescent;
    if (isAutoLineHeight && contentHeight > lineHeightPx) {
      const scale = lineHeightPx / contentHeight;
      effectiveAscent = positioningAscent * scale;
      effectiveDescent = positioningDescent * scale;
    }
    const baselineY =
      totalHeight + (lineHeightPx + effectiveAscent - effectiveDescent) / 2;

    segments.push({
      text: line,
      x,
      y: baselineY,
      width: lineWidth,
      height: lineHeightPx,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      color,
      ascent: metrics.ascent,
      textDecoration,
      letterSpacing,
      lineIndex: i,
      textStrokeWidth,
      textStrokeColor,
    });

    totalHeight += lineHeightPx;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }

  // When auto line-height (hhea-based) is smaller than the font content
  // area, the last line's glyph descent extends below totalHeight. Add the
  // overflow so the Yoga node height accommodates the full rendered text,
  // preventing descender clipping with overflow: hidden.
  if (
    isAutoLineHeight &&
    lastPositioningDescent !== undefined &&
    segments.length > 0
  ) {
    const lastSeg = segments[segments.length - 1]!;
    const descentOverflow = lastSeg.y + lastPositioningDescent - totalHeight;
    if (descentOverflow > 0) {
      totalHeight += descentOverflow;
    }
    // Round up so Yoga's integer rounding (pointScaleFactor=1) never clips
    // the descent. Without this, a fractional totalHeight like 15.52 can
    // round to 15, cutting off glyphs whose descent reaches 15.52.
    totalHeight = Math.ceil(totalHeight);
  }

  // Apply text-box-trim
  const textBoxTrim = style.textBoxTrim;
  if (textBoxTrim && textBoxTrim !== "none" && segments.length > 0) {
    const textBoxEdge = style.textBoxEdge ?? "text";
    const trimMetrics = measureTrimMetrics(
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      lineHeightPx,
      textBoxEdge,
      ctx,
      fontMetrics,
    );

    if (textBoxTrim === "trim-start" || textBoxTrim === "trim-both") {
      for (const seg of segments) {
        seg.y -= trimMetrics.overTrim;
      }
      totalHeight -= trimMetrics.overTrim;
    }

    if (textBoxTrim === "trim-end" || textBoxTrim === "trim-both") {
      totalHeight -= trimMetrics.underTrim;
    }
  }

  return {
    segments,
    width: maxLineWidth,
    height: totalHeight,
  };
}

function resolveTextStrokeWidth(
  style: ComputedStyle,
  fontSize: number,
): number | undefined {
  const raw = style.WebkitTextStrokeWidth;
  if (raw === undefined) return undefined;
  if (typeof raw === "number") return raw;
  const resolved = resolveUnit(String(raw), 0, 0, fontSize, 16);
  return typeof resolved === "number" ? resolved : undefined;
}

function applyTextTransform(text: string, style: ComputedStyle): string {
  if (style.textTransform === "uppercase") return text.toUpperCase();
  if (style.textTransform === "lowercase") return text.toLowerCase();
  if (style.textTransform === "capitalize") {
    return text.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return text;
}

function resolveLineHeight(
  lineHeight: number | string | undefined,
  fontSize: number,
  canvasMetrics?: TextMetrics,
  fontMetrics?: FontMetrics | null,
): number {
  if (lineHeight === undefined || lineHeight === "normal") {
    if (fontMetrics) {
      const px = fontMetricsToPx(fontMetrics, fontSize);
      return px.ascent + px.descent;
    }
    // Fallback to canvas metrics (fontBoundingBox ascent + descent)
    return canvasMetrics
      ? canvasMetrics.ascent + canvasMetrics.descent
      : fontSize * 1.2;
  }
  if (typeof lineHeight === "number") {
    // Already resolved to px in compute.ts if > 5, else multiplier
    return lineHeight > 5 ? lineHeight : lineHeight * fontSize;
  }
  const parsed = parseFloat(String(lineHeight));
  return isNaN(parsed) ? fontSize * 1.2 : parsed;
}

function wrapText(
  text: string,
  maxWidth: number,
  wordBreak: string,
  measure: (word: string) => number,
): string[] {
  if (!text) return [""];

  // A word wider than the line by itself is broken to fit, instead of left to
  // overflow. That's `break-word`; `break-all` gets the same until it breaks
  // between any two characters.
  const breakWords = wordBreak === "break-word" || wordBreak === "break-all";
  const breakOpps = findBreakOpportunities(text);
  const lines: string[] = [];
  let lineStart = 0;
  let lastBreak = 0;
  // Trailing whitespace hangs (as in CSS): it doesn't count toward whether the
  // line fits. Break positions sit after the space, so trim it here.
  const lineWidth = (end: number) =>
    measure(text.slice(lineStart, end).replace(/\s+$/, ""));

  for (const opp of breakOpps) {
    let width = lineWidth(opp.position);
    if (width > maxWidth && lastBreak > lineStart) {
      // Line overflows — break at last opportunity
      lines.push(text.slice(lineStart, lastBreak).replace(/\s+$/, ""));
      lineStart = lastBreak;
      width = lineWidth(opp.position);
    }
    if (width > maxWidth && breakWords) {
      // The line is one word, wider than the box: break it, and leave its
      // last piece to start the next line.
      lineStart = breakWord(
        text,
        lineStart,
        opp.position,
        maxWidth,
        measure,
        lines,
      );
    }

    if (opp.required) {
      // Hard break (newline)
      lines.push(text.slice(lineStart, opp.position).replace(/\s+$/, ""));
      lineStart = opp.position;
    }

    lastBreak = opp.position;
  }

  // Remaining text
  const remaining = text.slice(lineStart).replace(/\s+$/, "");
  if (remaining) lines.push(remaining);

  return lines.length > 0 ? lines : [""];
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Break the word in `text[start, end)` (trailing whitespace ignored) between
 * grapheme clusters, putting as much on each line as fits and at least one
 * cluster. Pushes every full line and returns where the last piece starts,
 * which the next words may join.
 */
function breakWord(
  text: string,
  start: number,
  end: number,
  maxWidth: number,
  measure: (word: string) => number,
  lines: string[],
): number {
  const word = text.slice(start, end).replace(/\s+$/, "");
  let pieceStart = 0;
  let lastBoundary = 0;
  const boundaries = [...graphemes.segment(word)].map((g) => g.index);
  boundaries.push(word.length);
  for (const boundary of boundaries) {
    if (
      lastBoundary > pieceStart &&
      measure(word.slice(pieceStart, boundary)) > maxWidth
    ) {
      lines.push(word.slice(pieceStart, lastBoundary));
      pieceStart = lastBoundary;
    }
    lastBoundary = boundary;
  }
  return start + pieceStart;
}

function truncateWithEllipsis(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  fontStyle: string,
  ctx?: SKRSContext2D,
  letterSpacing: number = 0,
): string {
  const ellipsis = "\u2026";
  const ellipsisWidth = measureWord(
    ellipsis,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    ctx,
    letterSpacing,
  );
  const availWidth = maxWidth - ellipsisWidth;

  for (let i = text.length; i > 0; i--) {
    const truncated = text.slice(0, i);
    const w = measureWord(
      truncated,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      ctx,
      letterSpacing,
    );
    if (w <= availWidth) {
      return truncated + ellipsis;
    }
  }

  return ellipsis;
}

/**
 * Sizes a text node for Yoga, and lays its text out for drawing at the width
 * Yoga finally gives it.
 *
 * Yoga measures a node at whatever widths its algorithm needs, and may size
 * the node (or its ancestors) from a measurement at a width other than the
 * final one — a flex basis at the available width, say, before the node
 * shrinks. Laid out again at the final width, the text can then take more or
 * fewer lines than the box was sized for. `settle` catches that: it lays the
 * text out at the final width and, when Yoga saw a different height, pins
 * every later measurement to the height drawn, for the caller to compute the
 * layout again. The widths Yoga is given, which decide the line breaks, are
 * unchanged by the pin, so the next layout normally keeps the node's width.
 */
export class TextMeasure {
  /** Yoga's measurements by width (Infinity for unbounded). */
  private readonly sizes = new Map<number, { width: number; height: number }>();
  /** Every height reported to Yoga since the last pin. */
  private readonly reported = new Set<number>();
  private pinnedHeight: number | undefined;
  private settled: { width: number; result: TextLayoutResult } | undefined;
  private readonly measureStyle: ComputedStyle;

  constructor(
    private readonly text: string,
    private readonly style: ComputedStyle,
    private readonly ctx?: SKRSContext2D,
    private readonly emojiEnabled?: boolean,
  ) {
    // Strip textOverflow during measurement so ellipsis truncation doesn't
    // shrink the reported width below the Yoga constraint.  The draw phase
    // still uses the original style (with textOverflow) for rendering.
    this.measureStyle = { ...style, textOverflow: "clip" };
  }

  /** The node's Yoga measure function. */
  readonly measure = (
    width: number,
    widthMode: MeasureMode,
  ): { width: number; height: number } => {
    const maxWidth =
      widthMode === MeasureMode.Undefined || Number.isNaN(width)
        ? Infinity
        : width;
    let size = this.sizes.get(maxWidth);
    if (!size) {
      const result = layoutText(
        this.text,
        this.measureStyle,
        maxWidth,
        this.ctx,
        this.emojiEnabled,
      );
      // When text wraps to multiple lines, report the constraint width (like
      // CSS block layout), so that the node is drawn at the width its lines
      // were broken at.
      const wrapped = result.segments.length > 1 && maxWidth < Infinity;
      size = {
        width: wrapped ? maxWidth : Math.min(result.width, maxWidth),
        height: result.height,
      };
      this.sizes.set(maxWidth, size);
    }
    const height = this.pinnedHeight ?? size.height;
    this.reported.add(height);
    return { width: size.width, height };
  };

  /**
   * Lay the text out for drawing at the node's final content width.
   *
   * @returns Whether Yoga sized the node from another height, in which case
   *   the node's measurements are now pinned to the drawn height and the
   *   caller should mark the node dirty and compute the layout again.
   */
  settle(width: number): boolean {
    if (this.settled?.width !== width) {
      this.settled = {
        width,
        result: layoutText(
          this.text,
          this.style,
          width,
          this.ctx,
          this.emojiEnabled,
        ),
      };
    }
    const { height } = this.settled.result;
    const agrees =
      this.reported.size === 0 ||
      (this.reported.size === 1 && this.reported.has(height));
    if (agrees) return false;
    this.pinnedHeight = height;
    this.reported.clear();
    return true;
  }

  /** The text laid out by the last `settle`, if it was at `width`. */
  layoutAt(width: number): TextLayoutResult | undefined {
    return this.settled?.width === width ? this.settled.result : undefined;
  }
}
