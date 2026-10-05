---
"@effing/canvas": minor
---

Lay out all text natively, and support `word-break` and `overflow-wrap`

All text is now laid out as one `@effing/skia` paragraph. The TypeScript
layout that text the paragraph couldn't express used to fall back to is gone,
so a text node is measured and drawn by the same layout, whatever its width.

- `wordBreak: "break-all"` breaks between any two letters, and
  `wordBreak: "keep-all"` doesn't break between CJK letters, as in CSS. Both
  used to break much as `normal` does.
- `overflowWrap` is supported: `break-word` and `anywhere` break a word wider
  than its line between grapheme clusters, as the deprecated
  `wordBreak: "break-word"` does. Without them such a word overflows its line.
- Emoji drawn as images take an inline box of 1em, its bottom 0.1em below the
  baseline, about where Chrome draws an emoji glyph. They used to sit in the
  middle of the line box, which put them below the text under a tall
  `lineHeight`.
- `whiteSpace: "pre-wrap"` keeps the spaces before a line break in the line,
  as `pre` does.
- A negative `lineHeight` is ignored, as CSS ignores it.
- `@effing/skia` is now 1.0.10-effing.3, and the `linebreak` dependency is
  dropped.
