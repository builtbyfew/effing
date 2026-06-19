---
"@effing/canvas": patch
---

Stop a CSS transform from clipping an element's own painting

The pure-scale offscreen path rasterized the subtree into a buffer sized to the
layout box (plus 1px) and hard-clipped to it, so any ink that legitimately
overflows the box — a trailing glyph pushed past the edge by negative
letter-spacing, italic overhang, glyph side bearings — was sliced off on every
transformed frame. The same element painted the overflow correctly without a
transform.

The offscreen buffer is now grown by the subtree's estimated ink/shadow
overflow (glyph overhang ≈ one em, plus any negative letter-spacing, plus
box-shadow extent) on every side, so transformed content keeps the overflow the
untransformed element would paint. Per the CSS spec, a transform never clips an
element's own content.
