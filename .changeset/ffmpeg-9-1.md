---
"@effing/ffmpeg": minor
---

Update pinned FFmpeg binaries from 9.0.2 to 9.1

Points the installer at the v9.1 effing-ffmpeg-builds release (still built with
mbedTLS 3.6.8) and refreshes the pinned SHA-256 checksums for all five targets.
FFmpeg 9.1 includes fixes for CVEs that affect 9.0.2 and have no 9.0.x release
yet, such as CVE-2026-107678 (stack exhaustion from recursive freeing of MP4
`pssh` boxes). With checksum verification on (the default), existing binaries
are replaced on the next install because they no longer match.
