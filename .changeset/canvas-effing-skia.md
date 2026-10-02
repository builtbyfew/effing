---
"@effing/canvas": minor
"@effing/dev": patch
---

Render with `@effing/skia` instead of `@napi-rs/canvas`, and install it as a
regular dependency instead of a peer.

`@effing/skia` is Effing's fork of `@napi-rs/canvas`: the same API, plus the
primitives the other changes in this release build on (unsnapped text, native
paragraphs, compositing groups). Code that imports from `@effing/canvas` needs
no change.

The backend is no longer a peer dependency: `@effing/canvas` depends on
`@effing/skia` at exactly `1.0.10-effing.2`, so it is installed with
`@effing/canvas` and no project has to list it. A project that lists
`@napi-rs/canvas` only to satisfy the old peer dependency can drop it.

`@effing/skia` ships prebuilt binaries for Linux x64 and arm64 (glibc and musl),
macOS x64 and arm64, and Windows x64. `@napi-rs/canvas`'s other targets (Linux
armv7 and riscv64, Android, Windows ARM64) are no longer supported.

`createCanvas().encode()` resolves with the backend's buffer as it is. It used
to be copied to the JavaScript heap, a guard against lifetime bugs in
`@napi-rs/canvas`'s asynchronous encode that `@effing/skia` does not have.

`effing build` now leaves `@effing/canvas` out of the bundle instead of its
backend, so the bundle loads the backend through `@effing/canvas`. A pnpm
project used to have to list the backend itself for its bundle to start; it no
longer does. The build also fails, naming the package, when the bundle imports
one that Node would not find from where the bundle sits.
