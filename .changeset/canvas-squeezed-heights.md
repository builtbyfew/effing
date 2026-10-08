---
"@effing/canvas": patch
---

Size squeezed text items for the lines they draw, in rows and columns

- A text item squeezed in a row could be sized one line tall while it drew
  several lines over the items below it. Its height had been checked against
  the lines at an earlier width, and Yoga kept sizing it from that height
  after the item moved to another width. It's now sized for the lines laid
  out at its final width.
- A column too short for its text items no longer shrinks them below their
  lines, as `min-height: auto` keeps them in CSS: they keep the height of
  their lines at their width, and overflow the column instead of each other.
  A `height` (or `maxHeight`) caps that, and an item with `overflow: hidden`
  or a `minHeight` of its own still shrinks, as in browsers.
