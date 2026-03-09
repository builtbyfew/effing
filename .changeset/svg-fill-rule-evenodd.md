---
"@effing/canvas": patch
---

Fix SVG `fillRule="evenodd"` not being applied. Compound paths with holes (e.g. a map pin with a circular cutout) were rendered solid because `ctx.fill()` defaulted to `"nonzero"`. The fill rule and clip rule are now read from element props and forwarded to the Canvas 2D API.
