---
"@effing/canvas": patch
---

Fix `<img>` and `<svg>` elements with percentage `width`/`height` HTML attributes (e.g. `<img width="100%" height="100%">`) collapsing to 0×0. Percentage strings are now preserved instead of being coerced through `Number()` which produced `NaN`.
