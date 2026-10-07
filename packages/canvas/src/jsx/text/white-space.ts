// White space processing, CSS Text 3 §4.1: the collapsing of phase I and the
// removal of collapsible spaces at the start and end of a line of phase II,
// for the `white-space` values that collapse spaces. Canvas lays out each run
// of text and `<br>`s between other elements as a flex item of its own, as a
// flex container has it, so the text of one text node is all there is to
// collapse across.

import type { ComputedStyle } from "../style/compute.ts";

type WhiteSpace = NonNullable<ComputedStyle["whiteSpace"]>;

/**
 * The text of a text node: a string, or, for text with `<br>`s in it, the
 * pieces of text between them, each `<br>` a forced line break. The breaks
 * are kept apart from the text, as no character in it can stand for one: a
 * newline is a space under `normal` and `nowrap`, and a line separator
 * (U+2028) is a space with a break opportunity after it, as in Chrome.
 */
export type TextContent = string | readonly string[];

/**
 * Whether `text` is nothing but white space: spaces, tabs, segment breaks,
 * form feeds and vertical tabs, the ASCII white space Chrome checks for. CSS
 * doesn't render a run of text in a flex container that is, under any
 * `white-space` (CSS Flexbox §4), as Chrome confirms.
 */
export function isWhiteSpaceOnly(text: string): boolean {
  return /^[ \t\n\r\f\v]*$/.test(text);
}

/**
 * Process the white space of a text box's text as CSS does, before it's
 * transformed and laid out (CSS Text 3 §1.3). Each piece of text between two
 * `<br>`s is processed on its own, as the lines a `<br>` ends and starts, and
 * every `<br>` is a forced break (a newline) under every `white-space`, as in
 * Chrome; `nowrap` included. Under `normal`, `nowrap` and `pre-line`:
 *
 * - a CRLF is one segment break, and a lone CR a space, as Chrome has them;
 * - tabs are spaces;
 * - the spaces around a segment break are removed;
 * - under `normal` and `nowrap`, a run of segment breaks is one space, where
 *   `pre-line` keeps each one as a forced break;
 * - a run of spaces is one space;
 * - the spaces at the start and end of the text, which start and end a line,
 *   are removed, and so are those before and after a `<br>`.
 *
 * The paragraph hangs the space at a line's soft wrap, as CSS does, so the
 * spaces at the start and end of the other lines take care of themselves.
 * Only ASCII white space collapses: a no-break space, say, is kept.
 *
 * `pre` and `pre-wrap` keep the spaces and tabs, and a lone CR, which the
 * paragraph lays out as Chrome does: with no width, no glyph and no break
 * opportunity, but as a break in the shaping, so the letters either side of
 * it don't kern or join. Under every value, a CRLF is one segment break, as
 * in Chrome (the paragraph would keep the CR in the line too, and draw it
 * before an ellipsis), and:
 *
 * - A segment break or a `<br>` at the very end of the text ends the last
 *   line, rather than starting an empty one, as in Chrome. This relies on
 *   the paragraph (`@effing/skia`'s `Paragraph`) starting an empty line after
 *   a hard break that ends its text: only one final break is removed, so
 *   that "a\n\n" or "a<br><br>" keeps the one that gives it its second,
 *   empty line, as in Chrome. A newline before a `<br>` is a break of its
 *   own under `pre`, `pre-wrap` and `pre-line`: "a\n<br>b" has an empty line
 *   between "a" and "b", as in Chrome.
 * - The paragraph breaks the line at a line or paragraph separator (U+2028,
 *   U+2029), a form feed or a vertical tab, where Chrome doesn't. Chrome sets
 *   a separator as a space that neither collapses nor hangs, with a break
 *   opportunity after it: a no-break space and a zero-width space are that
 *   to the paragraph. A form feed or a vertical tab is removed. Chrome draws
 *   a form feed as nothing under `pre` and `pre-wrap`; otherwise, and for a
 *   vertical tab under any value, it draws a fallback font's glyph for the
 *   control character, which this leaves out.
 */
export function collapseWhiteSpace(
  text: TextContent,
  whiteSpace: WhiteSpace | undefined,
): string {
  const pieces = typeof text === "string" ? [text] : text;
  // Once collapsed, the only newlines left are forced breaks. A lone CR that
  // ends a piece, kept under `pre` and `pre-wrap`, makes a CRLF with the
  // break after it, which is one newline like any other.
  return pieces
    .map((piece) => collapsePiece(piece, whiteSpace))
    .join("\n")
    .replace(/\r\n/g, "\n")
    .replace(FINAL_BREAK, "")
    .replace(SEPARATORS, SEPARATOR_SPACE);
}

/** Process the white space of text that a forced break or nothing ends. */
function collapsePiece(
  text: string,
  whiteSpace: WhiteSpace | undefined,
): string {
  let result = text.replace(/[\v\f]/g, "").replace(/\r\n/g, "\n");
  if (
    whiteSpace !== "pre" &&
    whiteSpace !== "pre-wrap" &&
    /[\t\n\r]| {2}|^ | $/.test(result)
  ) {
    // Most text has nothing to collapse: no tab, newline, CR, or space that
    // could be leading, trailing or doubled.
    result = result.replace(/[\t\r]/g, " ").replace(/ *\n */g, "\n");
    if (whiteSpace !== "pre-line") result = result.replace(/\n+/g, " ");
    result = result.replace(/ {2,}/g, " ").replace(/^ | $/g, "");
  }
  return result;
}

const FINAL_BREAK = /\n$/;

const SEPARATORS = /[\u2028\u2029]/g;

/**
 * A space that neither collapses nor hangs (a no-break space), followed by a
 * break opportunity (a zero-width space).
 */
const SEPARATOR_SPACE = "\u00a0\u200b";
