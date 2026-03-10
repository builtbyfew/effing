---
"@effing/canvas": patch
---

Add SVG gradient fill and stroke support to canvas renderer

The canvas renderer now processes `<linearGradient>` and `<radialGradient>`
definitions from SVG `<defs>`, applying gradient fills and strokes to shape
elements via `url(#id)` references.
