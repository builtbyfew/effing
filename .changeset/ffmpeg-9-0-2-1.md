---
"@effing/ffmpeg": patch
---

Update pinned FFmpeg binaries to the v9.0.2-1 build (mbedTLS 3.6.8)

Points the installer at the v9.0.2-1 effing-ffmpeg-builds release: FFmpeg 9.0.2
rebuilt against mbedTLS 3.6.8 on every platform. mbedTLS 3.6.8 fixes several
TLS vulnerabilities, including CVE-2026-115490, which affects FFmpeg's `https`
client: a malicious server could complete a handshake without key
establishment. Existing 9.0.2 binaries are replaced on the next install because
they no longer match the pinned checksums.
