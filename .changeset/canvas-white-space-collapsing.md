---
"@effing/canvas": patch
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

Under every `whiteSpace` value, a newline that ends the text no longer starts
an empty line, as in Chrome.

`findLargestUsableFontSize` with `whiteSpace: "nowrap"` now fits the text on
one line, newlines and all, as it's drawn; use `"pre"` to fit each
newline-separated paragraph on a line of its own.

In a container with elements, adjacent strings (as `Hello {name}` gives) are
now laid out as one run of text, as the browser does, instead of each on its
own. A run of nothing but white space between elements, such as `{" "}`, is
no longer rendered, as CSS has it for flex containers, so it no longer adds a
line to a column or a gap to a row. The leading white space after a `<br />`
is removed by the general rule.
