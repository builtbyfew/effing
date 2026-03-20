---
"@effing/canvas": minor
---

Add `findLargestUsableFontSize` for fitting text to a bounding box

Binary searches over integer font sizes using the built-in text layout engine to
find the largest size that keeps text within the given width and height. Supports
configurable line height, min/max font size bounds, and reuses the existing
`FontData` type.
