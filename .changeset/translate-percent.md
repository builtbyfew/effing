---
"@effing/canvas": patch
---

Resolve percentage values in CSS `translate()` transforms against the element's own dimensions. `translate(-50%, -50%)` now correctly shifts by half the element's width/height instead of being interpreted as pixels.
