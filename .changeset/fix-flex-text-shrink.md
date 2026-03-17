---
"@effing/canvas": patch
---

Default text-only flex items to flexShrink 1 to match satori

Text containers without an explicit flexShrink now shrink to fit their
available flex space instead of overflowing. Also handle `flex: "none"`
explicitly in style expansion.
