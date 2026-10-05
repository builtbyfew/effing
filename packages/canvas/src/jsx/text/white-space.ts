// White space processing, CSS Text 3 §4.1: the collapsing of phase I and the
// removal of collapsible spaces at the start and end of a line of phase II,
// for the `white-space` values that collapse spaces. Canvas lays out each run
// of text between elements as a flex item of its own, as a flex container
// has it, so the text of one text node is all there is to collapse across.

import type { ComputedStyle } from "../style/compute.ts";

type WhiteSpace = NonNullable<ComputedStyle["whiteSpace"]>;

/**
 * Whether `text` is nothing but white space: spaces, tabs and segment breaks.
 * CSS doesn't render a run of text in a flex container that is, under any
 * `white-space` (CSS Flexbox §4).
 */
export function isWhiteSpaceOnly(text: string): boolean {
  return /^[ \t\n\r]*$/.test(text);
}

/**
 * Process the white space of a text box's text as CSS does, before it's
 * transformed and laid out (CSS Text 3 §1.3). Under `normal`, `nowrap` and
 * `pre-line`:
 *
 * - a CRLF is one segment break, and a lone CR a space, as Chrome has them;
 * - tabs are spaces;
 * - the spaces around a segment break are removed;
 * - under `normal` and `nowrap`, a run of segment breaks is one space, where
 *   `pre-line` keeps each one as a forced break;
 * - a run of spaces is one space;
 * - the spaces at the start and end of the text, which start and end a line,
 *   are removed.
 *
 * The paragraph hangs the space at a line's soft wrap, as CSS does, so the
 * spaces at the start and end of the other lines take care of themselves.
 * Only ASCII white space collapses: a no-break space, say, is kept.
 *
 * `pre` and `pre-wrap` keep the spaces and tabs. Under every value that
 * keeps segment breaks, a segment break at the very end of the text ends
 * the last line, rather than starting an empty one.
 */
export function collapseWhiteSpace(
  text: string,
  whiteSpace: WhiteSpace | undefined,
): string {
  if (whiteSpace === "pre" || whiteSpace === "pre-wrap") {
    return text.replace(FINAL_BREAK, "");
  }
  // Nothing to do for most text: no tab, newline, CR, or space that could
  // be leading, trailing or doubled.
  if (!/[\t\n\r]| {2}|^ | $/.test(text)) return text;
  let result = text
    .replace(/\r\n/g, "\n")
    .replace(/[\t\r]/g, " ")
    .replace(/ *\n */g, "\n");
  if (whiteSpace !== "pre-line") result = result.replace(/\n+/g, " ");
  return result
    .replace(/ {2,}/g, " ")
    .replace(/^ | $/g, "")
    .replace(FINAL_BREAK, "");
}

const FINAL_BREAK = /\r?\n$/;
