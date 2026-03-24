---
"@effing/canvas": patch
---

Use hhea font metrics for text baseline positioning to match Satori

Baseline positioning now uses hhea-derived ascent/descent instead of canvas
`fontBoundingBoxAscent/Descent`. For fonts where these values diverge (e.g.
fonts with USE_TYPO_METRICS set and differing hhea vs sTypo ascenders), this
aligns our baseline calculation with Satori's. Also extracts a shared
`fontMetricsToPx` helper to eliminate duplicated hhea-to-pixel conversion.
