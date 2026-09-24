---
"@effing/canvas": patch
---

Fix scaled elements landing up to a pixel off from their unscaled position.

A `scale()` transform renders the element's subtree into an offscreen buffer
padded by a margin for overflowing ink, derived from the subtree's font sizes
and box-shadows. When that margin was fractional (e.g. `fontSize: 13.01`), the
buffer's whole-pixel size overshot the area it was composited back into, so the
scaled content shrank by up to a pixel toward the element's top-left, and it
was resampled off the pixel grid. An element animating from `scale(1)` to any
other scale visibly jumped. The margin is now rounded up to whole pixels.
