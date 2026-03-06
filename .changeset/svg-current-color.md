---
"@effing/canvas": patch
---

Fix `currentColor` in SVG `fill` and `stroke` attributes. The literal string was passed straight through to the canvas 2D API which doesn't understand it. It is now resolved to the inherited CSS `color` value.
