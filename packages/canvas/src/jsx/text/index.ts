// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { SKRSContext2D } from "@napi-rs/canvas";

import type { ComputedStyle } from "../style/compute.ts";
import { isEmoji } from "../language.ts";
import { findBreakOpportunities } from "./linebreak.ts";
import { measureText, measureWord } from "./measure.ts";
import type { TextMetrics } from "./measure.ts";

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
};

export type TextLayoutResult = {
  segments: TextSegment[];
  width: number;
  height: number;
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
 * Lay out text content into positioned segments with line-breaking.
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
  const fontFamily = style.fontFamily ?? "sans-serif";
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
  const lineHeightPx = resolveLineHeight(
    style.lineHeight,
    fontSize,
    refMetrics,
  );
  const letterSpacing =
    typeof style.letterSpacing === "number" ? style.letterSpacing : 0;
  const whiteSpace = style.whiteSpace ?? "normal";
  const wordBreak = style.wordBreak ?? "normal";
  const textOverflow = style.textOverflow ?? "clip";
  const textDecoration = style.textDecoration;

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

  // Apply text transform
  let processedText = text;
  if (style.textTransform === "uppercase") {
    processedText = text.toUpperCase();
  } else if (style.textTransform === "lowercase") {
    processedText = text.toLowerCase();
  } else if (style.textTransform === "capitalize") {
    processedText = text.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const noWrap = whiteSpace === "nowrap" || whiteSpace === "pre";
  const preserveWhitespace = whiteSpace === "pre" || whiteSpace === "pre-wrap";

  // Split by explicit newlines
  const paragraphs = preserveWhitespace
    ? processedText.split("\n")
    : processedText.split("\n");

  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (noWrap) {
      lines.push(paragraph);
      continue;
    }

    // Wrap text
    const wrapped = wrapText(
      paragraph,
      maxWidth,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      letterSpacing,
      wordBreak,
      ctx,
      measure,
    );
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

  // Create positioned segments
  const segments: TextSegment[] = [];
  let totalHeight = 0;
  let maxLineWidth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineWidth = measure(line);

    let x = 0;
    if (textAlign === "center") {
      x = (maxWidth - lineWidth) / 2;
    } else if (textAlign === "right") {
      x = maxWidth - lineWidth;
    }

    const metrics = measureText(
      line || "M",
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      ctx,
    );

    segments.push({
      text: line,
      x,
      y: totalHeight + (lineHeightPx + metrics.ascent - metrics.descent) / 2,
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
    });

    totalHeight += lineHeightPx;
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }

  return {
    segments,
    width: maxLineWidth,
    height: totalHeight,
  };
}

function resolveLineHeight(
  lineHeight: number | string | undefined,
  fontSize: number,
  metrics?: TextMetrics,
): number {
  if (lineHeight === undefined || lineHeight === "normal") {
    // CSS "normal": use font ascent + descent (matches satori behaviour)
    return metrics ? metrics.ascent + metrics.descent : fontSize * 1.2;
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
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  fontStyle: string,
  letterSpacing: number,
  wordBreak: string,
  ctx?: SKRSContext2D,
  measureFn?: (word: string, ls?: number) => number,
): string[] {
  if (!text) return [""];

  const mw =
    measureFn ??
    ((word: string) =>
      measureWord(
        word,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        ctx,
        letterSpacing,
      ));

  const breakOpps = findBreakOpportunities(text);
  const lines: string[] = [];
  let lineStart = 0;
  let lastBreak = 0;

  for (const opp of breakOpps) {
    const segment = text.slice(lineStart, opp.position);
    const segWidth = mw(segment);

    if (segWidth > maxWidth && lastBreak > lineStart) {
      // Line overflows — break at last opportunity
      const line = text.slice(lineStart, lastBreak).replace(/\s+$/, "");
      lines.push(line);
      lineStart = lastBreak;
    } else if (segWidth > maxWidth && wordBreak === "break-all") {
      // Force break within word
      const broken = forceBreakWord(
        text,
        lineStart,
        opp.position,
        maxWidth,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        ctx,
        letterSpacing,
        measureFn,
      );
      lines.push(...broken.lines);
      lineStart = broken.endPos;
    }

    if (opp.required) {
      // Hard break (newline)
      const line = text.slice(lineStart, opp.position).replace(/\s+$/, "");
      lines.push(line);
      lineStart = opp.position;
    }

    lastBreak = opp.position;
  }

  // Remaining text
  if (lineStart < text.length) {
    const remaining = text.slice(lineStart).replace(/\s+$/, "");
    if (remaining) {
      const remWidth = mw(remaining);
      if (remWidth > maxWidth && wordBreak === "break-all") {
        const broken = forceBreakWord(
          text,
          lineStart,
          text.length,
          maxWidth,
          fontSize,
          fontFamily,
          fontWeight,
          fontStyle,
          ctx,
          letterSpacing,
          measureFn,
        );
        lines.push(...broken.lines);
      } else {
        lines.push(remaining);
      }
    }
  }

  return lines.length > 0 ? lines : [""];
}

function forceBreakWord(
  text: string,
  start: number,
  end: number,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: number | string,
  fontStyle: string,
  ctx?: SKRSContext2D,
  letterSpacing: number = 0,
  measureFn?: (word: string, ls?: number) => number,
): { lines: string[]; endPos: number } {
  const mw =
    measureFn ??
    ((word: string) =>
      measureWord(
        word,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        ctx,
        letterSpacing,
      ));
  const lines: string[] = [];
  let pos = start;

  while (pos < end) {
    let breakPos = pos + 1;
    while (breakPos < end) {
      const chunk = text.slice(pos, breakPos + 1);
      const w = mw(chunk);
      if (w > maxWidth) break;
      breakPos++;
    }

    const line = text.slice(pos, breakPos);
    if (line.trim()) lines.push(line);
    pos = breakPos;
  }

  return { lines, endPos: end };
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

  for (let i = text.length - 1; i > 0; i--) {
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
 * Yoga-compatible measure function for text nodes.
 * Returns the dimensions needed for the text content.
 */
export function createTextMeasureFunc(
  text: string,
  style: ComputedStyle,
  ctx?: SKRSContext2D,
  emojiEnabled?: boolean,
) {
  // Strip textOverflow during measurement so ellipsis truncation doesn't
  // shrink the reported width below the Yoga constraint.  The draw phase
  // still uses the original style (with textOverflow) for rendering.
  const measureStyle = { ...style, textOverflow: "clip" as const };
  return (
    width: number,
    _widthMode: number,
    _height: number,
    _heightMode: number,
  ) => {
    const maxWidth = width > 0 ? width : Infinity;
    const result = layoutText(text, measureStyle, maxWidth, ctx, emojiEnabled);
    // When text wraps to multiple lines, return the constraint width (like CSS
    // block layout).  This ensures the draw phase re-layout gets the same
    // maxWidth and produces identical line-breaking.  Without this, the
    // measured content width (widest trimmed line) can be narrower than what
    // the wrapping algorithm needs (it checks untrimmed segments), causing the
    // draw phase to wrap differently.
    const wrapped = result.segments.length > 1;
    const reportedWidth = wrapped
      ? Math.min(maxWidth, width > 0 ? width : result.width)
      : result.width;
    return { width: Math.min(reportedWidth, maxWidth), height: result.height };
  };
}
