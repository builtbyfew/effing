# @effing/ffmpeg

**Platform-specific FFmpeg binary downloader.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Downloads a platform-specific FFmpeg binary at install time from the [effing-ffmpeg-builds](https://github.com/builtbyfew/effing-ffmpeg-builds) GitHub releases (currently tag **v6.1.5**, FFmpeg 6.1.5).

## Usage

```ts
import { pathToFFmpeg } from "@effing/ffmpeg";

// pathToFFmpeg is the absolute path to the binary, or null on unsupported platforms
```

## How it works

The `install` lifecycle script (`node install.mjs`) runs during `pnpm install` and:

1. Detects the current platform and architecture
2. Skips the download if the binary already exists
3. Downloads the gzipped binary from GitHub releases
4. Decompresses it and verifies its SHA-256 against the pinned digest in `checksums.json`
5. Sets executable permissions (only if verification passed)

On a checksum mismatch the partially downloaded file is removed and the install fails.

> **Maintenance:** every FFmpeg version bump (the release tag in `install.mjs`) must regenerate `checksums.json`. For each supported target: `curl -sL "<base-url>/ffmpeg-<platform>-<arch>.gz" | gunzip | shasum -a 256`

The binary is placed in the package root (`packages/ffmpeg/ffmpeg`). In the monorepo, pnpm symlinks mean all workspace consumers share the same binary.

## Supported platforms

| Platform | Architectures |
| -------- | ------------- |
| darwin   | x64, arm64    |
| linux    | x64, arm64    |
| win32    | x64           |

## Environment variables

| Variable               | Description                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `FFMPEG_BINARIES_URL`  | Override the base URL for binary downloads (defaults to the effing-ffmpeg-builds GitHub release)                           |
| `FFMPEG_SKIP_CHECKSUM` | Set to `1` to skip SHA-256 verification of the downloaded binary — only for custom builds served via `FFMPEG_BINARIES_URL` |
