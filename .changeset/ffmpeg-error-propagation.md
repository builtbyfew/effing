---
"@effing/ffs": patch
---

Surface non-zero ffmpeg exit codes as stream errors

The stream returned by `EffieRenderer.render()` (and used internally by the `ffs render` CLI and HTTP handlers) previously ended normally when the underlying ffmpeg process exited non-zero, letting callers' `pipeline()` resolve successfully on truncated or empty output. It now holds back the end-of-stream signal until ffmpeg has exited and emits an `error` event on non-zero exits so downstream consumers fail loudly.
