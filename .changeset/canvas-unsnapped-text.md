---
"@effing/canvas": minor
---

Draw text unhinted and unsnapped, so it stays put while a scale animates.

Glyphs used to be drawn as hinted masks snapped to the pixel grid, which
places text up to half a pixel away from where its geometry puts it, by an
amount that depends on the scale. To hide that, an element with a pure
`scale()` transform was rendered into a supersampled offscreen buffer and
composited back, which still made text jump when an animated scale crossed 1,
2, 3, … and the buffer changed resolution.

Text is now measured and filled as glyph outlines at their exact positions
(`textRendering: "geometricPrecision"` on `@effing/skia`), and every element is
drawn straight through its transform. Scaled text moves continuously with the
rest of the element, and a frame renders the same at any output scale. Text
pixels differ slightly from earlier versions: glyph edges are anti-aliased
where they fall rather than aligned to the pixel grid.
