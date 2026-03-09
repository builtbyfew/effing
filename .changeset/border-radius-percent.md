---
"@effing/canvas": patch
---

Fix CSS units being silently stripped in shorthand expansion (`margin`, `padding`, `borderRadius`, `gap`, etc.). `parseValue()` now uses `Number()` instead of `parseFloat()`, preserving unit strings like `"50%"`, `"2em"`, `"10px"` for downstream resolution. Border-radius properties are also added to `DIMENSION_PROPS` so `resolveUnits()` handles `em`/`rem`/`vw`/etc. on them.
