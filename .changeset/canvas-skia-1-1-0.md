---
"@effing/canvas": minor
---

Update to @effing/skia 1.1.0-effing.1, on upstream @napi-rs/canvas 1.1.0

- Rendered JSX keeps its text: @effing/skia's `geometricPrecision` text, which
  canvas draws and measures with, is unchanged under its default renderer.
- Gradients are now dithered (within a level of the undithered colour), and
  are laid out as Chrome lays them out, so gradient pixels can shift slightly.
  `blur()` and `contrast()` filters, which text shadows and CSS filters use,
  also differ from the previous ones by a few levels.
- A CSS `clip-path: path()` with invalid path data is still ignored (the
  element is left unclipped). canvas now checks the path data itself, since
  `Path2D` no longer throws on it. An empty or whitespace-only `path()` is
  ignored too, as in Chrome, instead of clipping the element away.
- An SVG `<path>` (or a `<clipPath>` path) whose `d` is invalid now
  draws the part before the error, as browsers do, instead of failing the
  render.
- For code that draws on a canvas from `createCanvas()` directly, upstream
  1.1.0 changes a few things: `ctx.font` is read as Chrome reads it, and an
  invalid value is ignored rather than throwing; `new Path2D(d)` keeps
  whatever path data parses before an error instead of throwing;
  `convertToBlob()` takes `{ type }`; and an `alpha: false` canvas starts
  out opaque black.
