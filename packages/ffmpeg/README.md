# @effing/ffmpeg

**Platform-specific FFmpeg binary downloader.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Downloads a platform-specific FFmpeg binary at install time from the [effing-ffmpeg-builds](https://github.com/builtbyfew/effing-ffmpeg-builds) GitHub releases (currently tag **v9.0.1**, FFmpeg 9.0.1).

## Usage

```ts
import { pathToFFmpeg } from "@effing/ffmpeg";

// pathToFFmpeg is the absolute path to the binary, or null on unsupported platforms
```

## How it works

The `install` lifecycle script (`node install.mjs`) runs during `pnpm install` and:

1. Detects the current platform and architecture
2. Skips the download if a binary already exists and its SHA-256 matches the pinned digest in `checksums.json` (a stale binary from an older release, or a truncated or wrong-arch one, is replaced)
3. Downloads the gzipped binary from GitHub releases
4. Decompresses it and verifies its SHA-256 against the pinned digest in `checksums.json`
5. Renames it into place and sets executable permissions (only if verification passed)

On a checksum mismatch the partially downloaded file is removed and the install fails; an existing binary is left untouched until its replacement has been verified.

> **Maintenance:** every FFmpeg version bump (`FFMPEG_VERSION` in `install.mjs`) must regenerate `checksums.json`. For each supported target: `curl -sL "<base-url>/ffmpeg-<platform>-<arch>.gz" | gunzip | shasum -a 256`

The binary is placed in the package root (`packages/ffmpeg/ffmpeg`). In the monorepo, pnpm symlinks mean all workspace consumers share the same binary.

## Supported platforms

| Platform | Architectures |
| -------- | ------------- |
| darwin   | x64, arm64    |
| linux    | x64, arm64    |
| win32    | x64           |

## Environment variables

| Variable               | Description                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FFMPEG_BINARIES_URL`  | Override the base URL for binary downloads (defaults to the effing-ffmpeg-builds GitHub release). The pinned checksums still apply, so a mirror must serve the same builds unless `FFMPEG_SKIP_CHECKSUM=1` is set |
| `FFMPEG_SKIP_CHECKSUM` | Set to `1` to skip SHA-256 verification of the downloaded binary and keep any existing binary as-is — only for custom builds served via `FFMPEG_BINARIES_URL`                                                     |
