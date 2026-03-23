---
"@effing/canvas": patch
---

Match Satori's `<img>` dimension derivation when no dimensions are set

When an `<img>` has neither width nor height, set `width: "100%"` and use
`setAspectRatio()` so the image fills its parent container, matching Satori's
behavior. Previously we fell back to natural pixel dimensions, causing layout
divergence.
