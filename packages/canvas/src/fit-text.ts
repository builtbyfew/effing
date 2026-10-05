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
   * Whitespace handling, as in CSS (default: `"normal"`). Use `"nowrap"` to
   * fit the text on one line instead of wrapping to `maxWidth`, its newlines
   * collapsing to spaces, or `"pre"` to fit each newline-separated paragraph
   * on a line of its own.
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
 * box. Set `whiteSpace: "nowrap"` to fit the text on one line instead (or
 * `"pre"` for one line per newline-separated paragraph), in which case
 * `maxWidth` constrains the full line width.
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
