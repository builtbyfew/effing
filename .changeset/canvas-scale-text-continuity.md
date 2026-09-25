---
"@effing/canvas": patch
---

Fix text jumping by a fraction of a pixel when an animated `scale()` crosses a
whole number.

A `scale()` transform renders the element's subtree into an offscreen buffer
supersampled by `ceil(|scale|)`. Skia hints glyphs and snaps their positions on
the device grid, so text rasterized at 2× or 3× lands slightly away from where
it lands at 1× or 2×, and switching factors outright moved text by up to about
a pixel as a scale went from 1 to 1.0001, or from 1.9999 to 2.0001. Boxes and
fills were unaffected. Just past each whole scale, the renderer now fades from
the lower supersample factor to the higher one, so scaled text moves
continuously and still matches the unscaled rendering at `scale(1)`.
