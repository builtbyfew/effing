---
"@effing/canvas": patch
---

Fix `<img>` elements with positional sizing (e.g. `position: absolute` with `top`/`left`/`right`/`bottom`) collapsing when no explicit `width`/`height` is set. Natural dimensions are no longer forced onto the style — only a missing dimension is derived when exactly one is provided.
