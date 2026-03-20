---
"@effing/canvas": patch
---

Ceil text node height to prevent Yoga integer rounding from clipping descenders

When auto line-height produces a fractional totalHeight (e.g. 15.52), Yoga's
integer rounding (pointScaleFactor=1) could round it down, clipping glyph
descenders like "g". Applying Math.ceil to totalHeight inside the auto
line-height block adds at most 1px, ensuring descenders are never cut off.
