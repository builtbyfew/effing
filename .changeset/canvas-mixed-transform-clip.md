---
"@effing/canvas": patch
---

Fix clipping of transformed content when `transform` combines `scale(...)` with `translate(...)` and/or `rotate(...)`

The scale path renders to a layout-box-sized offscreen and composites it back scaled, which keeps glyphs sharp under repeated rasterization. When the transform also contained a translate or rotate, that secondary transform was applied inside the offscreen — so any drawing it pushed beyond the layout box was clipped by the offscreen's bounds (and the destination rect on the main canvas wouldn't have covered it anyway). Mixed transforms now bypass the offscreen path and render directly to the main context with the full transform applied. Pure-scale transforms still go through the offscreen for crispness.
