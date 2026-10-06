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
- Text that only breaks where it's forced to (at a `<br />`, or at a newline
  under `pre`, `pre-wrap` or `pre-line`) is now as wide as its widest line,
  rather than the width available, so the items after it follow it.
