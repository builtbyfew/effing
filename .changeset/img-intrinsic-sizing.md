---
"@effing/canvas": minor
---

Intrinsic auto-sizing for `<img>` elements. When only one of `width`/`height` is specified (or neither), the missing dimension is now derived from the image's natural aspect ratio — matching browser behavior. Images are loaded during layout and cached to avoid a redundant load at draw time.
