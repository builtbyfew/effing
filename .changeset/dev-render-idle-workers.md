---
"@effing/dev": patch
---

`effing render` stops an app worker once it has been idle for half a second, so the memory it used to render a layer goes back before FFmpeg's encode needs it
