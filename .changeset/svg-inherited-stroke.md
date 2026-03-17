---
"@effing/canvas": patch
---

Inherit SVG stroke properties from parent `<g>` elements

Stroke attributes (stroke, strokeWidth, strokeLinecap, strokeLinejoin,
strokeOpacity) set on `<g>` elements now propagate to child shapes, matching
SVG spec inheritance behavior. Previously only fill was inherited, causing
stroke-only children to be invisible.
