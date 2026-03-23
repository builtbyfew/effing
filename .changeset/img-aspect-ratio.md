---
"@effing/canvas": patch
---

Use Yoga `setAspectRatio()` for `<img>` dimension derivation

Previously, the missing dimension was only derived when the set dimension was a
numeric pixel value. Percentage-based dimensions (e.g. `width="100%"`) and images
with no explicit dimensions did not preserve the intrinsic aspect ratio. Using
Yoga's native `setAspectRatio()` handles all cases uniformly.
