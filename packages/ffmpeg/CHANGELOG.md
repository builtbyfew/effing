# @effing/ffmpeg

## 0.38.4

## 0.38.3

## 0.38.2

## 0.38.1

### Patch Changes

- aaf07cc: Documentation accuracy pass across package READMEs, plus an `@effing/ffmpeg` fix: `pathToFFmpeg` now returns `null` on platforms that ship no bundled binary (`linux-ia32`, `linux-arm`, `win32-ia32`), matching the documented contract and the platforms `install.mjs` actually downloads.

  README corrections: `annieResponse` import moved to `@effing/fn` (annie); removed the non-exported `processMotion`/`processEffects`/`processTransition` section, fixed the `render:complete` payload example, and documented `EffieRendererOptions` (ffs); `fonts` marked optional (canvas); added the required `resolution` prop to the Quick Start (effie-preview); documented the `resolutions` `label` field (dev); added `currentFrame`, `seek()`, and the `Scrubber`/`FrameCounter` sub-components (annie-player); listed `effieFileUrl()` (effie).

## 0.38.0

## 0.37.1

## 0.37.0

## 0.36.2

## 0.36.1

## 0.36.0

## 0.35.3

## 0.35.2

## 0.35.1

## 0.35.0

## 0.34.0

## 0.33.1

### Patch Changes

- 81d7ca0: Upgrade bundled FFmpeg from 6.1.4 to 6.1.5

## 0.33.0

## 0.32.0

## 0.31.4

## 0.31.3

## 0.31.2

## 0.31.1

## 0.31.0

## 0.30.2

## 0.30.1

## 0.30.0

## 0.29.1

## 0.29.0

### Patch Changes

- 4521577: Upgrade bundled FFmpeg from 6.0 to 6.1.4. The 6.1 series fixes multiple known CVEs in FFmpeg 6.0 (heap overflows and use-after-free in filters/demuxers).

  Binaries are now sourced from `builtbyfew/effing-ffmpeg-builds` (built from source on GitHub-hosted runners) instead of `eugeneware/ffmpeg-static`. Linux binaries are fully static (musl-linked) and run on any distro including Alpine.

  Drops support for `linux-ia32`, `linux-arm` (32-bit), and `win32-ia32` — these architectures are no longer published. `darwin-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64`, and `win32-x64` remain supported.

## 0.28.0

## 0.27.0

## 0.26.1

### Patch Changes

- 64c9b1f: Change license from O'Saasy to MIT

## 0.26.0

## 0.25.1

## 0.25.0

## 0.24.8

## 0.24.7

## 0.24.6

## 0.24.5

## 0.24.4

## 0.24.3

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.2

## 0.23.1

## 0.23.0

## 0.22.3

## 0.22.2

## 0.22.1

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.1

## 0.20.0

## 0.19.3

## 0.19.2

## 0.19.1

## 0.19.0

## 0.18.6

## 0.18.5

## 0.18.4

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

## 0.17.1

## 0.17.0

## 0.16.0

## 0.15.1

## 0.15.0

## 0.14.1

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.0

## 0.11.2

### Patch Changes

- 8cabdce: Add CJS export so the package works when bundled in CommonJS format

## 0.11.1

## 0.11.0

## 0.10.5

## 0.10.4

## 0.10.3

## 0.10.2

## 0.10.1

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

## 0.6.1

## 0.6.0

## 0.5.0

### Minor Changes

- 3637c87: Add `@effing/ffmpeg` package for self-managed FFmpeg binaries
  - New workspace package that downloads FFmpeg 6.0 binaries at install time from ffmpeg-static GitHub releases
  - Replace third-party `ffmpeg-static` dependency in `@effing/ffs` with `@effing/ffmpeg`
