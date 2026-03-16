---
"@effing/canvas": patch
---

Add SVG `<rect rx>` rounded corners and `<mask>` support

The canvas renderer now correctly handles `rx`/`ry` attributes on SVG `<rect>`
elements, rendering rounded corners via `Path2D.roundRect()`. Previously these
attributes were ignored and all rects rendered with sharp corners. Additionally,
SVG `<mask>` definitions are now collected and applied via offscreen canvas
compositing with `destination-in`, matching browser rendering behavior.
