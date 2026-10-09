---
"@effing/canvas": patch
---

Use @effing/skia's own `line-height: normal` instead of computing it in canvas; drop other workarounds the fork no longer needs. No visible change.

Text with `textOverflow: "ellipsis"` is now measured with its ellipsis, as it's drawn; its measured width and height stay the same, since the paragraph's max-content width doesn't count the ellipsis.
