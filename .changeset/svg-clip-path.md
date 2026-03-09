---
"@effing/canvas": patch
---

Support SVG `<clipPath>` definitions in the canvas renderer. `<clipPath>` elements inside `<defs>` were silently skipped, and `clip-path="url(#id)"` attributes on elements were never resolved. The renderer now collects `<clipPath>` definitions in a first pass, builds a combined `Path2D` from their child shapes, and applies `ctx.clip()` before drawing elements that reference them.
