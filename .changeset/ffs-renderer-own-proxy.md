---
"@effing/ffs": patch
---

`EffieRenderer` now routes HTTP(S) video and audio URLs through its own local proxy when no `httpProxy` is given, so https sources render with the bundled FFmpeg 9, which can't verify TLS peers itself. Pass `httpProxy: false` to let FFmpeg open these URLs directly
