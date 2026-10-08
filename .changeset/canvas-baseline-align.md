---
"@effing/canvas": patch
---

Align items by their baselines under `alignItems: "baseline"` and `alignSelf: "baseline"`, as in CSS

Yoga's JS binding has no baseline function, so a row aligned its items by
their boxes' bottoms: next to text of two lines, a small label sat at the
bottom of the second line, where browsers put it on the first line's
baseline. Canvas now aligns them by their first baselines, as Chrome does:

- Text by its first line's baseline, with `lineHeight` normal or set, and
  `textBoxTrim`; wrapped text and text with forced breaks by its first line.
- An element by the baseline of its text, below its padding and border, or
  of its first item (in a row, its first item aligned by its baseline): a
  card with a title aligns by the title, a nested baseline row by its
  shared baseline. A box with no items aligns by its bottom edge.
- Runs of text between elements, items with top margins, and each line of a
  row that wraps. A row grows to fit the items it aligns.
