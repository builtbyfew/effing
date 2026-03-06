---
"@effing/canvas": patch
---

Fix `textAlign: "center"` (and `"right"`) on divs. The text child yoga node now sets `flexGrow: 1` and `flexShrink: 1` so it fills the parent's width, giving `layoutText` the full container width to calculate alignment offsets against.
