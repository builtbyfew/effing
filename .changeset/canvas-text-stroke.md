---
"@effing/canvas": minor
---

Add WebkitTextStroke support for text stroke effects

Support `WebkitTextStroke`, `WebkitTextStrokeWidth`, and `WebkitTextStrokeColor`
CSS properties. The shorthand is expanded into width and color longhands, both
properties inherit like `color`, and stroke is drawn before fill (paint-order:
stroke) using `ctx.strokeText()` with round line joins.
