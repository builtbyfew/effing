import type { FontData } from "./types.ts";
import type { ComputedStyle } from "./jsx/style/compute.ts";
import { registerFont } from "./jsx/font.ts";
import { layoutText } from "./jsx/text/index.ts";

/**
 * Options for {@link findLargestUsableFontSize}.
 */
export type FindLargestUsableFontSizeOptions = {
  /** The text to fit */
  text: string;
  /** Font data to use for measurement */
  font: FontData;
  /** Maximum width in pixels */
  maxWidth: number;
  /** Maximum height in pixels */
  maxHeight: number;
  /** Line height — `"normal"` uses font metrics, numeric values are CSS multipliers */
  lineHeight?: number | "normal";
  /**
   * Whitespace handling, mirroring CSS. Use `"nowrap"` (or `"pre"`) to fit text
   * on a single line instead of wrapping to `maxWidth` (default: `"normal"`).
   */
  whiteSpace?: ComputedStyle["whiteSpace"];
  /** Minimum font size to consider (default: 1) */
  minFontSize?: number;
  /** Maximum font size to consider (default: 1000) */
  maxFontSize?: number;
};

/**
 * Find the largest integer font size that keeps text within the given bounds.
 *
 * Uses binary search over integer font sizes, measuring with {@link layoutText}
 * at each step. Returns `minFontSize` if even the smallest size overflows.
 *
 * By default text wraps to `maxWidth` and is fit into the `maxWidth` × `maxHeight`
 * box. Set `whiteSpace: "nowrap"` to fit the text on a single line instead, in
 * which case `maxWidth` constrains the full line width.
 */
export function findLargestUsableFontSize(
  options: FindLargestUsableFontSizeOptions,
): number {
  const {
    text,
    font,
    maxWidth,
    maxHeight,
    lineHeight = "normal",
    whiteSpace,
    minFontSize = 1,
    maxFontSize = 1000,
  } = options;

  registerFont(font);

  let lo = minFontSize;
  let hi = maxFontSize;
  let best = minFontSize;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const style: ComputedStyle = {
      fontSize: mid,
      fontFamily: font.name,
      fontWeight: font.weight,
      fontStyle: font.style,
      lineHeight: lineHeight === "normal" ? undefined : lineHeight,
      whiteSpace,
    };

    const result = layoutText(text, style, maxWidth);

    if (result.width <= maxWidth && result.height <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}
