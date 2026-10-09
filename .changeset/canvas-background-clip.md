---
"@effing/canvas": patch
---

A `url()` background is clipped to its box, as in CSS, so a tile larger than the element no longer draws outside it. A `url()` background of a zero-size image no longer hangs the render.
