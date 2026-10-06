// This file contains code adapted from Satori (https://github.com/vercel/satori)
// Licensed under the Mozilla Public License 2.0 (MPL-2.0)
// See NOTICE.md in the package root for details.

import type { ComputedStyle } from "../style/compute.ts";
import { resolveUnit } from "../style/compute.ts";
import { layoutTextNative } from "./native.ts";
import type { NativeParagraph } from "./native.ts";
import { collapseWhiteSpace } from "./white-space.ts";
import type { TextContent } from "./white-space.ts";

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
   * The width of the widest line between forced breaks, were no line to wrap
   * (CSS max-content).
   */
  maxContentWidth: number;
  /**
   * The width of the widest run of text that can't break: a word, or a line
   * that doesn't wrap (CSS min-content). An `overflow-wrap: break-word` that
   * breaks a word doesn't count, as in CSS; `anywhere` does, but the
   * paragraph knows it as `break-word` (see `TextMeasure.minContentWidth`).
   */
  minContentWidth: number;
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
 * @param text - The text to lay out, or the pieces of it between its `<br>`s
 * @param style - Computed style
 * @param maxWidth - Maximum width for wrapping
 * @param emojiEnabled - Whether emoji are drawn as images
 * @returns Text segments with positions and total dimensions, and the
 *   paragraph to paint
 */
export function layoutText(
  text: TextContent,
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
 * Round a text width for Yoga up to 1/64px, as Chrome does: it lays out in
 * units of 1/64px, and rounds the width of text up to them. That also keeps
 * Yoga's sums exact. It shrinks flex items in float32, and when every item
 * that shrinks in a line is held at its minimum width, the shrink factors it
 * sums and takes away again can leave a rounding error behind, which it then
 * divides by: the items grow to millions of pixels. Rounding up keeps the
 * text on the lines it was measured with.
 */
function toLayoutGrid(width: number): number {
  return Math.ceil(width * 64) / 64;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

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
  /**
   * Yoga's measurements by width (Infinity for unbounded), and those at
   * exactly a width.
   */
  private readonly sizes = new Map<number, { width: number; height: number }>();
  private readonly exactSizes = new Map<
    number,
    { width: number; height: number }
  >();
  /** The heights reported to Yoga since the last `settle`. */
  private readonly reported = new Set<number>();
  private pinnedHeight: number | undefined;
  private settled: { width: number; result: TextLayoutResult } | undefined;
  /**
   * The text's intrinsic widths, from whichever layout came first: its
   * max-content width, and a bound on its min-content width, which is the
   * min-content width but where finding it takes more (see `widestGrapheme`).
   */
  private intrinsic:
    { max: number; minBound: number; min: number | undefined } | undefined;
  private readonly measureStyle: ComputedStyle;

  constructor(
    private readonly text: TextContent,
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
   * @param exact - Whether the node is exactly `maxWidth` wide, whatever its
   *   text: it's then measured for its height there
   */
  measure(maxWidth: number, exact = false): { width: number; height: number } {
    const sizes = exact ? this.exactSizes : this.sizes;
    let size = sizes.get(maxWidth);
    if (!size) {
      let result = this.layOut(maxWidth);
      // Text is as wide as CSS fit-content makes it. When it wraps, that's
      // the constraint width (like CSS block layout), so that the node is
      // drawn at the width its lines were broken at, unless a run that can't
      // break is wider: then it's as wide as that run (its min-content), and
      // laid out at that width, as it will be drawn. Text that only breaks
      // where it's forced to is as wide as its widest line (max-content),
      // without the ellipsis a line clamp adds: the clamped line is truncated
      // to fit that width when it's drawn, as in Chrome.
      let width: number;
      if (exact) {
        width = maxWidth;
      } else if (result.maxContentWidth > maxWidth) {
        width =
          this.minContentBound <= maxWidth
            ? maxWidth
            : Math.max(maxWidth, this.minContentWidth);
        if (width > maxWidth) result = this.layOut(width);
      } else {
        width = Math.min(
          toLayoutGrid(Math.min(result.width, result.maxContentWidth)),
          maxWidth,
        );
      }
      size = { width, height: result.height };
      sizes.set(maxWidth, size);
    }
    const height = this.pinnedHeight ?? size.height;
    this.reported.add(height);
    return { width: size.width, height };
  }

  /**
   * The text's min-content width: as narrow as it gets, each run of it that
   * can't break on a line of its own. As CSS has it, that's the widest word,
   * or the widest line for text that doesn't wrap, and under
   * `overflow-wrap: anywhere` (or `word-break: break-word`) and
   * `word-break: break-all` the widest letter. Text truncated with an
   * ellipsis (`text-overflow: ellipsis` without wrapping, or a line clamp)
   * has none: it's drawn at whatever width it has, which CSS gives it in
   * the `overflow: hidden` box an ellipsis needs.
   *
   * Never wider than the text's widest line, and on the layout grid (see
   * `toLayoutGrid`), as the widths `measure` reports are.
   */
  get minContentWidth(): number {
    const intrinsic = this.intrinsic ?? this.measureIntrinsic();
    intrinsic.min ??= Math.min(
      toLayoutGrid(this.widestGrapheme()),
      intrinsic.minBound,
    );
    return intrinsic.min;
  }

  /** At least the text's min-content width, and found without more work. */
  get minContentBound(): number {
    return (this.intrinsic ?? this.measureIntrinsic()).minBound;
  }

  /**
   * The text's max-content width: its widest line, were no line to wrap, on
   * the layout grid.
   */
  get maxContentWidth(): number {
    return (this.intrinsic ?? this.measureIntrinsic()).max;
  }

  /** Whether the text can't be narrower than its widest line. */
  get unbreakable(): boolean {
    return this.minContentBound >= this.maxContentWidth;
  }

  private measureIntrinsic(): NonNullable<TextMeasure["intrinsic"]> {
    this.layOut(Infinity);
    return this.intrinsic!;
  }

  private layOut(width: number): TextLayoutResult {
    const result = layoutText(
      this.text,
      this.measureStyle,
      width,
      this.emojiEnabled,
    );
    this.intrinsic ??= this.intrinsicOf(result);
    return result;
  }

  /** The intrinsic widths of the text, from a layout of it at any width. */
  private intrinsicOf(
    result: TextLayoutResult,
  ): NonNullable<TextMeasure["intrinsic"]> {
    const { style } = this;
    const max = toLayoutGrid(result.maxContentWidth);
    const noWrap = style.whiteSpace === "nowrap" || style.whiteSpace === "pre";
    if (
      (style.lineClamp !== undefined && style.lineClamp >= 1) ||
      (noWrap && style.textOverflow === "ellipsis")
    ) {
      return { max, minBound: 0, min: 0 };
    }
    // Every layout of text that doesn't wrap has the same lines. The
    // paragraph gives its min-content as its max-content, which it rounds
    // up: the widest line is what's drawn.
    const minBound = Math.min(
      toLayoutGrid(
        noWrap
          ? Math.min(result.minContentWidth, result.width)
          : result.minContentWidth,
      ),
      max,
    );
    // The paragraph breaks a word under `anywhere` as under `break-word`,
    // which a word's min-content doesn't count: its widest word is a bound.
    const anywhere =
      !noWrap &&
      (style.overflowWrap === "anywhere" || style.wordBreak === "break-word");
    return { max, minBound, min: anywhere ? undefined : minBound };
  }

  /**
   * The width of the text's widest grapheme cluster: its min-content where
   * a line may break between any two. Each one is laid out once, as a word
   * of its own.
   */
  private widestGrapheme(): number {
    const text = applyTextTransform(
      collapseWhiteSpace(this.text, this.style.whiteSpace),
      this.style,
    );
    // Latin text is a grapheme per character; other scripts and emoji may
    // join several.
    const graphemes = new Set<string>(
      /^[\s!-\u02ff]*$/.test(text)
        ? text
        : Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment),
    );
    for (const grapheme of graphemes) {
      if (/^\s+$/.test(grapheme)) graphemes.delete(grapheme);
    }
    if (graphemes.size === 0) return 0;
    return layoutText(
      [...graphemes].join(" "),
      {
        ...this.measureStyle,
        whiteSpace: "normal",
        wordBreak: "normal",
        overflowWrap: "normal",
        textTransform: "none",
      },
      Infinity,
      this.emojiEnabled,
    ).minContentWidth;
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
