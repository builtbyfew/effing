---
"@effing/ffmpeg": minor
"@effing/ffs": patch
---

Add `@effing/ffmpeg` package for self-managed FFmpeg binaries

- New workspace package that downloads FFmpeg 6.0 binaries at install time from ffmpeg-static GitHub releases
- Replace third-party `ffmpeg-static` dependency in `@effing/ffs` with `@effing/ffmpeg`
