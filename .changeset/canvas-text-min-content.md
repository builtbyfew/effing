---
"@effing/canvas": patch
---

Don't shrink text below its min-content width, so text too wide for its box stays centred

Text that can't wrap (`whiteSpace: "nowrap"`, or a single word) and is
wider than its box shrank to the box, and since 0.43 a line that overflows
starts at its box's edge, so it was no longer centred in a centring parent:
it started at the box's left edge and ran off to the right. In CSS a flex
item is never narrower than its min-content width (`min-width: auto`), so
Chrome keeps such text as wide as its line and centres it, overflowing on
both sides. Canvas now does the same.

- In a row, an element that holds only text, and a run of text between
  elements, are at least as wide as the text's widest word, or its widest
  line where it doesn't wrap, padding and borders included. A `width` or
  `maxWidth` caps that, and there is no minimum with a `minWidth` of the
  element's own, with `overflow: "hidden"` (or `scroll` or `auto`), or for an
  absolutely positioned element, as in CSS.
- Text truncated with an ellipsis (`textOverflow: "ellipsis"` without
  wrapping, or `lineClamp`) still shrinks to its box and is truncated there.
- Under `overflowWrap: "anywhere"`, `wordBreak: "break-all"` and
  `wordBreak: "break-word"`, words still break to fit the box. Under
  `overflowWrap: "break-word"`, the min-content is still the whole word, as
  in CSS: a word only breaks where the box can't grow to it.
- Across a column (`alignItems: "center"` and the like), text that can't fit
  is as wide as its widest word or line, rather than the width available.
- Text widths are now rounded up to 1/64px, as Chrome lays them out. Boxes
  sized by text can come out a pixel wider where that rounding crosses half
  a pixel, as in Chrome.

Layouts that relied on text shrinking below its words change: a row of text
items that can't fit now overflows its container, as in Chrome. Give an item
`minWidth: 0` or `overflow: "hidden"` to let its box shrink (the text then
overflows the box), or an ellipsis to truncate the text.
