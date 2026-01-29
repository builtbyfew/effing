---
"@effing/ffs": patch
---

Pass HTTP video/audio URLs directly to FFmpeg

HTTP(S) video and audio sources are now passed directly to FFmpeg instead of downloading them first. This reduces memory usage and avoids unnecessary file I/O for streaming media.
