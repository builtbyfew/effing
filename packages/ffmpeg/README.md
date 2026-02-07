# @effing/ffmpeg

FFmpeg binary downloader for the Effing monorepo. Downloads a platform-specific FFmpeg binary at install time from the [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) GitHub releases (currently tag **b6.0**, FFmpeg 6.0).

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
4. Decompresses it and sets executable permissions

The binary is placed in the package root (`packages/ffmpeg/ffmpeg`). In the monorepo, pnpm symlinks mean all workspace consumers share the same binary.

## Supported platforms

| Platform | Architectures         |
| -------- | --------------------- |
| darwin   | x64, arm64            |
| linux    | x64, ia32, arm64, arm |
| win32    | x64, ia32             |

## Environment variables

| Variable              | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `FFMPEG_BINARIES_URL` | Override the base URL for binary downloads (defaults to the ffmpeg-static GitHub release) |
