---
"@effing/canvas": minor
---

Re-export `Path2D`, `ImageData`, `DOMMatrix`, `DOMPoint`, `DOMRect`, `PathOp`,
`FillType`, `StrokeJoin` and `StrokeCap` from `@napi-rs/canvas`.

Previously only `Canvas`, `GlobalFonts`, `Image` and `LottieAnimation` were
re-exported, so building a `Path2D` (for `ctx.fill(path)`, `ctx.clip(path)`,
etc.) required importing from `@napi-rs/canvas` directly. Because
`@napi-rs/canvas` is a peer dependency, that import fails under pnpm unless the
consuming project also declares it as a direct dependency. All of these can now
be imported from `@effing/canvas`, which also guarantees they come from the same
native copy as the canvas context they are used with.
