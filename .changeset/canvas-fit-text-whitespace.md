---
"@effing/canvas": minor
---

Add `whiteSpace` option to `findLargestUsableFontSize` for single-line fitting

`findLargestUsableFontSize` wraps text to `maxWidth` and fits it into the
`maxWidth` × `maxHeight` box, so for a single-line use case it overshoots —
a larger font is accepted by spilling onto more lines. The new `whiteSpace`
option mirrors the CSS property (forwarded into the layout engine the same
way `lineHeight` already is); pass `"nowrap"` (or `"pre"`) to fit the text on
a single line, where `maxWidth` constrains the full line width. Defaults to
`"normal"` (wrapping), so existing callers are unaffected.
