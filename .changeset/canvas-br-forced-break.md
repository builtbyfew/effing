---
"@effing/canvas": patch
---

Make `<br />` a forced line break inside a run of text, as in browsers

A `<br />` used to be a flex item of its own, with no size: in a column it
put the text after it on the next line, but in a row (the default
`flexDirection`) `First line <br /> second line` set the two lines side by
side, where browsers stack them.

- A `<br />` is now part of the run of text around it, which is laid out as
  one item, and breaks the line there: in a row as in a column, at the start
  or end of the text, several in a row for empty lines, and inside
  fragments, arrays and components.
- It breaks the line under every `whiteSpace`, `nowrap` included, and the
  spaces, tabs and newlines before and after it are removed where spaces
  collapse. Under `pre`, `pre-wrap` and `pre-line`, a newline next to it is
  a break of its own, as in browsers.
- A `<br />` between two elements is an item of one empty line, and one with
  `display: none` is left out.
- Text with more than one line that only breaks where it's forced to (at a
  `<br />`, or at a newline under `pre`, `pre-wrap` or `pre-line`) is now as
  wide as its widest line, rather than the full width available, so the
  items after it follow it and a background drawn behind it fits it. With
  `lineClamp`, that width leaves out the ellipsis, and the clamped line is
  truncated to fit it, as in Chrome.

Layouts that relied on the old behaviour change:

- `gap` no longer applies between the lines either side of a `<br />`: they
  are one item now, as in Chrome.
- In a column, the lines either side of a `<br />` used to be separate items,
  each 23px tall with Liberation Sans at 20px. They are now lines of one
  run, spaced at the `normal` line height that canvas gives any wrapped
  text: 23px with that font, as in Chrome, so the column is as tall as
  before.
