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
`@effing/skia` at exactly `1.0.10-effing.1`, so it is installed with
`@effing/canvas` and no project has to list it. A project that lists
`@napi-rs/canvas` only to satisfy the old peer dependency can drop it. The
exception is a pnpm project that runs an `effing build` bundle: the bundle
resolves the backend from the project's own `node_modules`, so such a project
should list `@effing/skia`, at the same version, in place of `@napi-rs/canvas`.

`@effing/skia` ships prebuilt binaries for Linux x64 and arm64 (glibc and musl),
macOS x64 and arm64, and Windows x64. `@napi-rs/canvas`'s other targets (Linux
armv7 and riscv64, Android, Windows ARM64) are no longer supported.

`effing build` keeps `@effing/skia` out of the bundle, as it did
`@napi-rs/canvas`.
