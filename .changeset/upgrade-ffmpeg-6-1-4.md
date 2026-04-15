---
"@effing/ffmpeg": patch
---

Upgrade bundled FFmpeg from 6.0 to 6.1.4. The 6.1 series fixes multiple known CVEs in FFmpeg 6.0 (heap overflows and use-after-free in filters/demuxers).

Binaries are now sourced from `builtbyfew/effing-ffmpeg-builds` (built from source on GitHub-hosted runners) instead of `eugeneware/ffmpeg-static`. Linux binaries are fully static (musl-linked) and run on any distro including Alpine.

Drops support for `linux-ia32`, `linux-arm` (32-bit), and `win32-ia32` — these architectures are no longer published. `darwin-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64`, and `win32-x64` remain supported.
