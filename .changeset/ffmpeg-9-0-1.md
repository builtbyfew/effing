---
"@effing/ffmpeg": minor
---

Update pinned FFmpeg binaries from 6.1.6 to 9.0.1

Points the installer at the v9.0.1 effing-ffmpeg-builds release and refreshes
the pinned SHA-256 checksums for all five platform binaries. The installer now
also replaces an already-downloaded binary when `ffmpeg -version` reports a
different version than the pinned one, so version bumps no longer leave a stale
binary behind on existing installs.

Note: FFmpeg 9.0 verifies TLS peer certificates by default and this static
build's mbedTLS backend only trusts CAs passed via `-ca_file`, so opening
`https://` inputs with the binary directly requires a CA bundle (or
`-tls_verify 0`). `@effing/ffs` routes such inputs through its Node.js proxy.
