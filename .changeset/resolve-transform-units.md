---
"@effing/canvas": patch
---

Generalize CSS unit resolution in `transform` and `transformOrigin` strings. Units like `vw`, `vh`, `em`, `rem`, `px`, `pt`, etc. are now resolved to pixel values at layout time instead of being silently dropped by `parseFloat()` at draw time.
