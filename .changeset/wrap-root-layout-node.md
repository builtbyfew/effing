---
"@effing/canvas": patch
---

Wrap root element in a canvas-sized container node during layout

The layout tree now always wraps the user's root element in a container node
sized to the canvas dimensions, matching how Satori handles root layout. This
fixes `position: absolute` on root elements where `top/left/right/bottom` edges
were ignored because the root node's width/height were overridden to the full
canvas size after styles were applied.
