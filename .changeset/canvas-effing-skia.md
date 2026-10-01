---
"@effing/canvas": minor
"@effing/dev": patch
---

Render with `@effing/skia` instead of `@napi-rs/canvas`.

`@effing/skia` is Effing's fork of `@napi-rs/canvas`: the same API and the
same Skia, plus primitives `@effing/canvas` will build on. The peer dependency
is now `@effing/skia` at exactly `1.0.9-effing.1`; rendering is unchanged, pixel
for pixel. Projects that list `@napi-rs/canvas` themselves only to satisfy the
peer dependency should list `@effing/skia` instead (package managers that
install peers automatically need no change), and code that imports from
`@effing/canvas` needs no change.

`@effing/skia` ships prebuilt binaries for Linux x64 and arm64 (glibc and musl),
macOS x64 and arm64, and Windows x64. `@napi-rs/canvas`'s other targets (Linux
armv7 and riscv64, Android, Windows ARM64) are no longer supported.

`effing build` keeps `@effing/skia` out of the bundle, as it did
`@napi-rs/canvas`.
