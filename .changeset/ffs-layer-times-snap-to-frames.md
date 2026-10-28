---
"@effing/ffs": patch
"@effing/effie": patch
---

FFS now takes a layer's `delay`, `from` and `until` to mean their nearest frame. A layer handing over to the next at times given off the frame grid, such as `until: 2.933` and `delay: 2.967` for frames 88 and 89 at 30 fps, no longer leaves those frames uncovered. Exact fractions such as `107/30`, which floating point puts a hair past the frame, no longer drop a frame either.
