---
"@effing/canvas": minor
---

Update to @effing/skia 1.0.10-effing.9: rasterise frames off the JS thread

- `canvas.encode()` now rasterises on @effing/skia's encode threads as well
  as encoding there, so frames in flight rasterise in parallel instead of
  one at a time on the JS thread. A canvas that was read or flushed since
  it was created or last cleared whole (`getImageData`, `toBuffer`), has
  `alpha: false` or has a Lottie frame on it still rasterises on the JS
  thread, as does a second `encode()` of the same drawing in most cases.
  `encodeSync()`, `toBuffer()`, `toDataURL()`, `toDataURLAsync()`,
  `toBlob()` and `convertToBlob()` still rasterise on the calling thread.
  Encoded bytes are unchanged.
- The system fonts and the user's font directories load once per process,
  on a thread of their own, instead of on every worker thread that loads
  @effing/canvas. Font operations wait for that load, and a process that
  exits while it runs waits for it to finish. A font added to a user font
  directory while the process runs is no longer picked up by a later
  worker.
- On Linux, fonts in `/usr/local/share/fonts` now load as system fonts.
