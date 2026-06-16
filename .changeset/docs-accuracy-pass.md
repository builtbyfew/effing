---
"@effing/ffmpeg": patch
---

Documentation accuracy pass across package READMEs, plus an `@effing/ffmpeg` fix: `pathToFFmpeg` now returns `null` on platforms that ship no bundled binary (`linux-ia32`, `linux-arm`, `win32-ia32`), matching the documented contract and the platforms `install.mjs` actually downloads.

README corrections: `annieResponse` import moved to `@effing/fn` (annie); removed the non-exported `processMotion`/`processEffects`/`processTransition` section, fixed the `render:complete` payload example, and documented `EffieRendererOptions` (ffs); `fonts` marked optional (canvas); added the required `resolution` prop to the Quick Start (effie-preview); documented the `resolutions` `label` field (dev); added `currentFrame`, `seek()`, and the `Scrubber`/`FrameCounter` sub-components (annie-player); listed `effieFileUrl()` (effie).
