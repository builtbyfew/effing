---
"@effing/canvas": patch
---

Fix percentage unit handling across layout and drawing pipeline

Percentage strings like `width="100%"` on `<svg>` and `<img>` elements were
silently dropped during viewBox/aspect-ratio derivation, causing the numeric
part to be treated as pixels. SVG child shapes with percentage attributes
(e.g. `<rect width="50%">`) produced NaN via `Number()`. Percentage padding
and border-width values were also silently stripped by `parseFloat()`.
