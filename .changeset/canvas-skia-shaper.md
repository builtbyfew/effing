---
"@effing/canvas": minor
---

Lay text out with the Blink-style shaper (@effing/skia 1.1.1-effing.1)

`@effing/skia` 1.1.1-effing.1 is on upstream `@napi-rs/canvas` 1.1.1, whose
Blink-style shaper draws canvas text. Canvas now lays its text out with that
shaper too (`engine: 'shaper'` on the fork's `Paragraph`), instead of
SkParagraph. Line boxes, line breaking, justification, soft hyphens and
ellipses work as before. Text layout is about 3 to 4 times faster.

What changes:

- Text is shaped by bidi run, as Chrome's inline layout shapes it, with
  Chrome's script segmentation, font fallback and letter spacing. Letter
  spacing now also spaces the spaces between the words of a cursive script
  (Arabic), as Chrome does.
- Fonts are matched as canvas text matches them: family names in any case,
  and of equally good faces the one registered last.
- A line truncated with an ellipsis is cut at its end edge, as Chrome cuts
  it: where it ends in right-to-left text in a left-to-right paragraph, the
  start of that text goes, not its end.
- For code that draws on a canvas from `createCanvas()` directly, upstream
  1.1.1 lays `fillText`, `strokeText` and `measureText` out with the same
  shaper, adds `fontFeatureSettings`, `fontVariantLigatures` and other text
  properties, and floors every font size to 1/100px.
