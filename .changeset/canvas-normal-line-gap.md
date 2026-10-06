---
"@effing/canvas": patch
---

Size `line-height: normal` line boxes as Chrome does, line gap included

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

The line gap is read from the fonts registered with their data
(`renderReactElement`'s `fonts`, `registerFont`, `registerFontFromPath`); a
system font counts as having none. Chrome on Linux puts the baseline a pixel
higher for fonts whose descent it rounds down; renders follow macOS on every
platform.
