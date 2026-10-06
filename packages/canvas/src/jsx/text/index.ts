// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { ComputedStyle } from "../style/compute.ts";
import { resolveUnit } from "../style/compute.ts";
import { layoutTextNative } from "./native.ts";
import type { NativeParagraph } from "./native.ts";
import { collapseWhiteSpace } from "./white-space.ts";

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
   * The paragraph to paint. The segments describe its lines, for
   * decorations.
   */
  paragraph: NativeParagraph;
  /** Vertical offset to paint `paragraph` at, relative to the text box. */
  paragraphOffsetY: number;
  /** Emoji to draw as images, in the inline boxes the paragraph left them. */
  emoji: PlacedEmoji[];
};

/** An emoji drawn as an image, at its inline box in the text box. */
export type PlacedEmoji = {
  /** The emoji's grapheme cluster. */
  grapheme: string;
  /** Top-left corner of its box. */
  x: number;
  y: number;
  /** The image's width and height. */
  size: number;
  /** Baseline of its line, to draw the emoji as text when there's no image. */
  baseline: number;
};

/**
 * Lay out text content into positioned lines, as one native paragraph that
 * Skia breaks, shapes and paints (see `./native.ts`). White space collapses
 * as `white-space` has it, before `text-transform` applies, as in CSS.
 *
 * @param text - The text to lay out
 * @param style - Computed style
 * @param maxWidth - Maximum width for wrapping
 * @param emojiEnabled - Whether emoji are drawn as images
 * @returns Text segments with positions and total dimensions, and the
 *   paragraph to paint
 */
export function layoutText(
  text: string,
  style: ComputedStyle,
  maxWidth: number,
  emojiEnabled?: boolean,
): TextLayoutResult {
  const fontSize = style.fontSize ?? 16;
  const result = layoutTextNative(
    applyTextTransform(collapseWhiteSpace(text, style.whiteSpace), style),
    style,
    maxWidth,
    resolveLineHeight(style.lineHeight, fontSize),
    emojiEnabled,
  );
  const textStrokeWidth = resolveTextStrokeWidth(style, fontSize);
  for (const seg of result.segments) {
    seg.textStrokeWidth = textStrokeWidth;
    seg.textStrokeColor = style.WebkitTextStrokeColor;
  }
  return result;
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

/**
 * The line box height in px, or undefined for `normal`, which the paragraph
 * takes from the font. A height of 0 collapses the line boxes, as in CSS.
 */
function resolveLineHeight(
  lineHeight: number | string | undefined,
  fontSize: number,
): number | undefined {
  if (lineHeight === undefined || lineHeight === "normal") return undefined;
  let px: number;
  if (typeof lineHeight === "number") {
    // Already resolved to px in compute.ts if > 5, else multiplier
    px = lineHeight > 5 ? lineHeight : lineHeight * fontSize;
  } else {
    px = parseFloat(lineHeight);
  }
  // A negative line height is invalid in CSS, as is anything unparsable:
  // `normal` it is.
  return Number.isFinite(px) && px >= 0 ? px : undefined;
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
  /** The heights reported to Yoga since the last `settle`. */
  private readonly reported = new Set<number>();
  private pinnedHeight: number | undefined;
  private settled: { width: number; result: TextLayoutResult } | undefined;
  private readonly measureStyle: ComputedStyle;

  constructor(
    private readonly text: string,
    private readonly style: ComputedStyle,
    private readonly emojiEnabled?: boolean,
  ) {
    // Strip textOverflow during measurement so ellipsis truncation doesn't
    // shrink the reported width below the Yoga constraint.  The draw phase
    // still uses the original style (with textOverflow) for rendering.
    this.measureStyle = { ...style, textOverflow: "clip" };
  }

  /**
   * Measure the text for Yoga.
   *
   * @param maxWidth - The width available, Infinity for unbounded
   */
  measure(maxWidth: number): { width: number; height: number } {
    let size = this.sizes.get(maxWidth);
    if (!size) {
      const result = layoutText(
        this.text,
        this.measureStyle,
        maxWidth,
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
  }

  /**
   * Lay the text out for drawing at the node's final content width, and
   * check it against the heights Yoga was given since the last call.
   *
   * @param pin - Whether to pin later measurements to the drawn height when
   *   they disagree
   * @returns Whether Yoga sized the node from another height. If `pin`, the
   *   node's measurements are now pinned to the drawn height, and the caller
   *   should mark the node dirty and compute the layout again.
   */
  settle(width: number, pin: boolean): boolean {
    if (this.settled?.width !== width) {
      this.settled = {
        width,
        result: layoutText(this.text, this.style, width, this.emojiEnabled),
      };
    }
    const { height } = this.settled.result;
    const agrees =
      this.reported.size === 0 ||
      (this.reported.size === 1 && this.reported.has(height));
    this.reported.clear();
    if (agrees) return false;
    if (pin) this.pinnedHeight = height;
    return true;
  }

  /**
   * Drop the pinned height, so that Yoga sees the measured heights again.
   *
   * @returns Whether there was a pin
   */
  unpin(): boolean {
    const pinned = this.pinnedHeight !== undefined;
    this.pinnedHeight = undefined;
    this.reported.clear();
    return pinned;
  }

  /** The text as laid out by the last `settle`. */
  get layout(): TextLayoutResult | undefined {
    return this.settled?.result;
  }
}
