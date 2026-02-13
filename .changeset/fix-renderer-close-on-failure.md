---
"@effing/ffs": patch
---

Close `EffieRenderer` in `renderAndUploadInternal` on failure

`EffieRenderer` was not closed if rendering or upload threw, leaving ffmpeg resources alive longer than intended. Wrap render/upload in `try/finally` so `renderer.close()` runs unconditionally.
