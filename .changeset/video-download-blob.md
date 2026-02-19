---
"@effing/effie-preview": minor
---

Expose downloaded video blob via `onFullyBuffered` callback. `useVideoStream` now collects all streamed chunks into a `blobRef` and `EffieVideoPreview`/`EffieCoverPreview` pass the `Blob` to `onFullyBuffered(blob)`, enabling consumers to create a download link without re-fetching.
