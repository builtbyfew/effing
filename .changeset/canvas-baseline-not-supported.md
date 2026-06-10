---
"@effing/canvas": patch
---

Document that `align-items: baseline` / `align-self: baseline` is not true baseline alignment

`baseline` was listed as a supported `alignItems` / `alignSelf` value, but the
bundled Yoga layout engine's JS binding exposes no baseline function, so it
aligns children to the line-box bottom (the same result as `flex-end`) rather
than to the typographic baseline. Rows mixing different font sizes do not share
a text baseline. The README now states this limitation explicitly (the same
caveat applies to Satori, from which the layout engine is derived); behavior is
unchanged.
