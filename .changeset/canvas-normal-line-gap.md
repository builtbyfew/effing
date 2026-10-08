---
"@effing/canvas": patch
---

Size `line-height: normal` line boxes as Chrome does, line gap included (@effing/skia 1.0.10-effing.5)

A `normal` line box is now the font's hhea ascent, descent and line gap, each
rounded to whole pixels, with the baseline at the rounded ascent plus half the
line gap (rounded down), as Chrome lays it out on macOS. Before, it was the
unrounded ascent plus descent without the line gap, and the text's height was
rounded up as a whole.

Text with `line-height: normal` changes height. For fonts with a line gap, it
gets taller by about a pixel per line: Liberation Sans at 20px is 23px a line
where it was 22.34px, so three lines are 69px where they were 68px. For fonts
without one, each line now rounds to a whole pixel, up or down: Noto Sans
Myanmar at 20px is 43px a line where it was 43.68px. Glyphs move to Chrome's
baseline, by up to about a pixel; `text-box-trim` trims to the rounded ascent
and descent; and `findLargestUsableFontSize` can pick a smaller size where the
taller lines no longer fit. Explicit line heights don't change.

The metrics are those of the first available font in the `fontFamily` list,
system fonts and fonts registered through `GlobalFonts` included. Chrome also
grows a line for a fallback font that draws some of its text, which canvas
doesn't yet. Chrome on Linux puts the baseline a pixel higher for fonts whose
descent it rounds down; renders follow macOS on every platform.

Line boxes follow fonts registered or removed through `GlobalFonts` too, as
@effing/skia's font revision counter tells canvas of them.

With @effing/skia 1.0.10-effing.5, text also matches Chrome in three more
places:

- Under `pre` and `pre-wrap`, a lone CR is kept instead of dropped. It is
  still drawn as nothing and doesn't break the line, but the letters either
  side of it no longer kern or join: `"A\rV"` is as wide as in Chrome.
- A line or paragraph separator (U+2028, U+2029) gets `letterSpacing` once,
  not twice.
- Under `pre`, a clamped line that ends at a newline now gets an ellipsis
  ("ab…"), as under `pre-line` and `pre-wrap`.
