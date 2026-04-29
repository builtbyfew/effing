---
"@effing/create": patch
---

Allow `@effing/ffmpeg` install script to run under pnpm

Adds `pnpm.onlyBuiltDependencies` to the scaffolded project's `package.json`
so pnpm 9+/10 runs the `@effing/ffmpeg` postinstall that downloads the
ffmpeg binary. Without this, scaffolded projects using pnpm would silently
skip the binary download and `ffs` would have no ffmpeg to invoke.
