---
"@effing/canvas": patch
---

Fix SVG elements with a `viewBox` but only one of `width`/`height` specified rendering as invisible. The missing dimension is now derived from the viewBox aspect ratio.
