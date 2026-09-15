---
"@effing/ffmpeg": minor
---

Update pinned FFmpeg binaries from 6.1.6 to 9.0.1

Points the installer at the v9.0.1 effing-ffmpeg-builds release and refreshes
the pinned SHA-256 checksums for all five platform binaries. The installer now
also replaces an already-downloaded binary whose SHA-256 does not match the
pinned digest, so version bumps (and truncated or wrong-arch binaries) no
longer leave a stale binary behind on existing installs. The existing binary
stays in place until its replacement has been downloaded and verified, and
with `FFMPEG_SKIP_CHECKSUM=1` an existing binary is kept as-is.

Note: FFmpeg 9.0 verifies TLS peer certificates by default and this static
build's mbedTLS backend only trusts CAs passed via `-ca_file`, so opening
`https://` inputs with the binary directly requires a CA bundle (or
`-tls_verify 0`). The `@effing/ffs` server and CLI route such inputs through
their Node.js proxy.
