---
"@effing/canvas": patch
---

Use ctx.reset() in offscreen canvas pool to fully reset context state

Replaces manual setTransform + clearRect with ctx.reset() when reusing pooled
canvases. This prevents leaking styles, clipping regions, and saved state from
previous consumers.
