---
"@effing/canvas": minor
---

Lay text out with the Blink-style shaper (@effing/skia 1.1.1-effing.1)

`@effing/skia` 1.1.1-effing.1 is on upstream `@napi-rs/canvas` 1.1.1, whose
Blink-style shaper draws canvas text. Canvas now lays its text out with that
shaper too (`engine: 'shaper'` on the fork's `Paragraph`), instead of
SkParagraph. Line boxes, line breaking, justification and soft hyphens work
as before. Laying out text seen before (a video's next frame, Yoga measuring
a node again) is about 1.5 to 2 times faster, as the shaper caches its lines.
Short new text takes about as long as before; a long new paragraph can take
up to about half as long again.

What changes:

- Fonts resolve as Chrome resolves them. A family that isn't registered
  (`sans-serif`, `serif`, `monospace`, or a name like `"Helvetica"`) now
  resolves to the matching installed family, as in a browser, where
  SkParagraph took one default font for all of them. So text rendered with
  `fonts: []`, or in a family that isn't registered, can take another font
  and line height than before. A family with no installed match (a
  misspelled name, `cursive`) now falls back to the default serif font, as
  in Chrome, where SkParagraph took the default sans-serif one. Family
  names match in any case, and of two equally good fonts registered under
  one family name, the one registered last draws, where SkParagraph took
  the first.
- A character none of the given fonts has is drawn by an installed font
  that has it, as browsers do, rather than as a missing glyph. What such
  characters look like now depends on the machine's fonts; register a font
  that covers them to keep them the same everywhere.
- Text is shaped by bidi run, as Chrome's inline layout shapes it, with
  Chrome's script segmentation and letter spacing. Letter spacing now also
  spaces the spaces between the words of a cursive script (Arabic), as
  Chrome does.
- A line truncated with an ellipsis, unless it is justified, is cut at its
  end edge, as Chrome cuts it: where it ends in right-to-left text in a
  left-to-right paragraph, the start of that text goes, not its end.
- For code that draws on a canvas from `createCanvas()` directly, upstream
  1.1.1 lays `fillText`, `strokeText` and `measureText` out with the same
  shaper, adds `fontFeatureSettings`, `fontVariantLigatures` and other text
  properties, and floors font sizes to 1/100px.
