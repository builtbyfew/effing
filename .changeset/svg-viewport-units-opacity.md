---
"@effing/canvas": patch
---

Resolve viewport-relative units on SVG width/height and apply opacity on `<g>` and shape elements

SVG elements with viewport-relative units like `width="25vw"` previously resolved to NaN and rendered nothing. The width/height merging now uses `resolveUnit` to handle vw, vh, vmin, vmax, em, rem, etc.

The `opacity` property on `<g>` elements was silently ignored. It is now applied via `globalAlpha`, and the same treatment is applied to individual shape elements (`<path>`, `<rect>`, etc.) for consistency.
