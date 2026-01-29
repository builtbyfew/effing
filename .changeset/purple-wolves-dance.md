---
"@effing/ffs": patch
---

Use "cover" mode for background scaling

Backgrounds are now scaled to fill the frame while maintaining aspect ratio, cropping any overflow. This matches CSS `background-size: cover` behavior.
