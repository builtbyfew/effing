---
"@effing/canvas": patch
---

Skip flexGrow on implicit text children when justifyContent is non-default

When a flex container has `justifyContent: "center"` (or other non-default
values), the implicit text child no longer gets `flexGrow: 1`, allowing yoga to
position it correctly instead of stretching it to fill the parent.
