---
"@effing/canvas": patch
---

Fall back to natural image dimensions when no width or height is set

Images with no explicit dimensions could collapse to 0x0 because
`setAspectRatio()` alone gives Yoga a ratio but no concrete dimension to derive
from. Now the natural pixel size is used as the default, matching browser
`<img>` behavior.
