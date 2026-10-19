---
"@effing/ffmpeg": patch
---

Update pinned FFmpeg binaries from 9.0.1 to 9.0.2

Points the installer at the v9.0.2 effing-ffmpeg-builds release and refreshes
the pinned SHA-256 checksums for all five targets. Existing 9.0.1 binaries are
replaced on the next install because they no longer match the pinned checksum.
