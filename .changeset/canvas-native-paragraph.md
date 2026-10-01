---
"@effing/canvas": minor
---

Lay text out natively, as one paragraph that Skia breaks, shapes and paints.

Text used to be wrapped in TypeScript by measuring it word by word, and each
line drawn with its own `fillText` (one per character with `letterSpacing`).
A text node is now a single `Paragraph` of `@effing/skia`: one native call
lays it out, one paints it. On a 1080×1080 frame with a text card, a frame
takes 0.8 ms where it took 1.0 ms, even though glyphs are now filled as
outlines.

Line boxes follow the same CSS model as before (each exactly `lineHeight`
tall, the baseline placed by half-leading from the font's hhea metrics), and
in the test suite lines break where they did. What changes:

- `textAlign: "justify"` now justifies wrapped lines; it used to left-align.
- Line widths are no longer rounded to 1/100px.

The TypeScript layout remains for what a paragraph can't express:
`wordBreak: "break-all"`, emoji drawn as images, and a word wider than its
box, which overflows unbroken as in CSS.
