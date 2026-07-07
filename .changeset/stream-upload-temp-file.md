---
"@effing/ffs": patch
---

Stream rendered videos to a temp file and upload from disk instead of buffering the whole MP4 in memory, keeping peak memory bounded during render-and-upload.
