---
"@effing/canvas": patch
---

Size text boxes for the lines drawn in them.

Yoga measures a text node at whatever widths its layout needs, and the text
is drawn at the node's final width. When the two differed, a box could be a
line taller or shorter than its text. Text is now laid out once more at its
final width during layout, the node sized again where that changes its
height, and the same layout drawn. Text squeezed to no width is also measured
at that width, not as unbounded.

Text boxes also keep the fractional width their text was measured at, where
Yoga used to round them out to whole pixels, so text breaks where Chrome
breaks it: three equal 98.33px columns wrap "Hello world" (98.93px) to two
lines, as Chrome does, instead of drawing it on one line in a box sized for
two. Text is still placed on whole pixels.

`wordBreak: "break-word"` now breaks a word that is wider than its line, as
in CSS, where it used to leave it overflowing like `normal`. `break-all`
breaks such words wherever they are on a line (it missed one that followed
other words), and still doesn't break between any two characters.

A last word wider than its box overflows unbroken like any other, where it
was broken mid-word. Empty text is laid out natively.
