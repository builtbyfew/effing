---
"@effing/canvas": minor
---

Add width/height override options to renderReactElement

Layout dimensions now default to `ctx.canvas.width` / `ctx.canvas.height` but
can be overridden via optional `width` and `height` fields in
`RenderReactElementOptions`. This enables the standard HiDPI canvas pattern
(oversized canvas + `ctx.scale(dpr, dpr)`) without layout happening at the
physical pixel size.
