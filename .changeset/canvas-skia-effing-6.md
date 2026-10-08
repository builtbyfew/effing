---
"@effing/canvas": minor
---

Update to @effing/skia 1.0.10-effing.6: CSS drop shadows, soft hyphens, wider justification, Chrome's baselines and font matching

Filters:

- `filter: drop-shadow(...)` blurs twice as much as before, as CSS defines
  it: its blur length is the standard deviation, as for `blur()`, where it
  was half of it. Halve the blur length for the old look. `boxShadow` and
  `textShadow` are unchanged.
- Filter values that CSS rejects are now ignored, so the element has no
  filter, where they used to be clamped or drawn in black: a negative amount
  or blur length (`blur(-1px)`, `opacity(-1)`), a unitless `hue-rotate(90)`,
  or a `drop-shadow()` whose colour can't be read.

Text:

- A line that breaks at a soft hyphen (U+00AD) ends with a hyphen, as in
  browsers.
- Justified text spreads at no-break spaces too, and around CJK characters
  (kana, punctuation and fullwidth forms as well as ideographs), as in
  Chrome.
- A justified line that `lineClamp` cuts is justified first, then cut for
  the ellipsis, as in Chrome ("jumps over the la…" where it was "jumps over
  the lazy…").
- A line that starts after the space it wrapped at no longer kerns against
  that space, so it's measured as wide as in Chrome, and a few lines break
  elsewhere.
- With a set `lineHeight`, baselines are placed by Chrome's half-leading,
  from the font's ascent and descent rounded to whole pixels: they move by
  up to about 1px (Liberation Sans at 20px in 30px lines: 22px down each
  line, where it was 21.93px), and `textBoxTrim` trims to the rounded ascent
  and descent. `normal` line boxes don't change.
- Text is laid out at the font size floored to 1/100px, as in Chrome
  (17.3px is 17.29px), which changes widths at fractional sizes by up to
  about 0.13%.

Fonts:

- A font registered under the name of a system font (through `fonts`,
  `registerFont`, `registerFontFromPath` or `GlobalFonts`) replaces that
  system family in every style, as `@font-face` does in browsers: styles you
  don't register are synthesized from the ones you do. Register every style
  you use.
- `fontWeight` takes any weight from 1 to 1000 (`550`), as CSS does; one
  outside that range is ignored and the parent's applies.
- A `.ttc` or `.otc` font collection loads every face in it, not only the
  first.
- Bold italic in a family with bold and italic faces but no bold italic one
  is the italic face emboldened, as in Chrome, where it was the bold face
  slanted, and lines can break elsewhere.
