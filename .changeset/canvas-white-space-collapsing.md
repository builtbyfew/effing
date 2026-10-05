---
"@effing/canvas": minor
---

Collapse white space as CSS does

Text under `whiteSpace: "normal"` (the default), `"nowrap"` and `"pre-line"`
now has its white space processed as CSS Text 3 §4.1 has it, before
`textTransform` applies:

- A newline (or CRLF) becomes a space under `normal` and `nowrap`, so
  `"a\nb"` is one line, "a b", as in Chrome. `pre-line` keeps each newline as
  a line break.
- Spaces and tabs around a newline are removed, tabs become spaces, and a run
  of spaces collapses to one.
- Spaces at the start and end of the text are removed.

Under every `whiteSpace` value, as in Chrome:

- A newline that ends the text no longer starts an empty line.
- A line or paragraph separator (U+2028, U+2029) is a space with a break
  opportunity after it, no longer a line break, and a form feed or vertical
  tab no longer breaks the line.

`findLargestUsableFontSize` with `whiteSpace: "nowrap"` now fits the text on
one line, newlines and all, as it's drawn, so text with newlines can get a
smaller size than before; use `"pre"` to fit each newline-separated paragraph
on a line of its own.

Children are now laid out as the DOM has them: fragments, arrays and function
components are unwrapped, so adjacent strings (as `Hello {name}` gives, or
text across a fragment or component) are one run of text, and the content of
a component that returns an array is no longer dropped. Each run of text
between elements is a flex item of its own, as browsers lay out text in a flex
container:

- An empty or white-space-only run between elements no longer holds a line
  box, so `{" "}` between two elements no longer adds a line to a column or a
  `gap` to a row.
- An element whose only text is empty or white space has no line box either:
  it's 0px tall unless its style gives it a size.
- The leading white space after a `<br />` is removed by the general rule.
