---
"@effing/canvas": patch
---

Require `@napi-rs/canvas` 1.0.0

Bump the `@napi-rs/canvas` peer dependency from `>=0.1.50` to `>=1.0.0`, adopting
the now-stable 1.0 release of the underlying Skia bindings. Upstream reports no
breaking API changes from the 0.1.x line, and the canvas comparison suite renders
pixel-identical output, so this is a drop-in upgrade for the rendering path —
consumers just need to provide `@napi-rs/canvas@^1` going forward.
