---
"@effing/canvas": minor
---

Support `backgroundRepeat` and decompose the `background` shorthand

Add `backgroundRepeat` support for `backgroundImage: url(...)` layers, with
`repeat` (default), `no-repeat`, `repeat-x`, and `repeat-y`. Previously the
renderer always tiled in both directions.

Also expand the `background` shorthand into its longhand parts
(`backgroundColor`, `backgroundImage`, `backgroundRepeat`, `backgroundSize`)
so values like `background: #eee url(foo.png) no-repeat center / cover` are
now decomposed correctly. Position, attachment, and `<box>` keywords are
recognized but currently dropped (the renderer doesn't honor them yet).
