# @effing/ffs

## 0.4.0

### Minor Changes

- a716c0b: Support `PORT` env var fallback and backend API keys
  - `PORT` is now used as fallback when `FFS_PORT` is not set (precedence: `FFS_PORT` > `PORT` > `2000`), improving compatibility with hosting platforms like Railway, Render, and Heroku
  - New `FFS_WARMUP_BACKEND_API_KEY` and `FFS_RENDER_BACKEND_API_KEY` environment variables for authenticating to backends when using backend separation

### Patch Changes

- @effing/effie@0.4.0

## 0.3.0

### Minor Changes

- d2aedba: Add separate TTL configuration for source caching vs job metadata
  - New `FFS_SOURCE_CACHE_TTL_MS` environment variable for cached sources (default: 60 minutes)
  - New `FFS_JOB_METADATA_TTL_MS` environment variable for job metadata (default: 8 hours)
  - Removes `FFS_TRANSIENT_STORE_TTL_MS` in favor of the two separate TTLs
  - Jobs are deleted after use, so the longer job TTL only applies to orphaned jobs

- d6d2edf: Add unified `/warmup-and-render` endpoint that combines warmup and render into a single SSE stream
  - New `POST /warmup-and-render` endpoint creates a combined job
  - New `GET /warmup-and-render/:id` streams progress for both phases with prefixed events (`warmup:*`, `render:*`)
  - Add backend separation support via `FFS_WARMUP_BACKEND_BASE_URL` and `FFS_RENDER_BACKEND_BASE_URL` environment variables

### Patch Changes

- @effing/effie@0.3.0

## 0.2.0

### Minor Changes

- e67c47a: Add HTTP proxy for FFmpeg URL handling

  Static FFmpeg binaries can have DNS resolution issues on Alpine Linux (musl libc). This adds an HTTP proxy that routes video/audio URLs through localhost, letting Node.js handle DNS lookups instead of FFmpeg.
  - Add `HttpProxy` class with `start()`, `transformUrl()`, and `close()` methods
  - Make `createServerContext()` async to ensure proxy is ready before handling requests
  - Pass `httpProxy` to `EffieRenderer` which transforms URLs via `urlTransformer` callback

### Patch Changes

- a852902: Use "cover" mode for background scaling

  Backgrounds are now scaled to fill the frame while maintaining aspect ratio, cropping any overflow. This matches CSS `background-size: cover` behavior.

- 5865b01: Pass HTTP video/audio URLs directly to FFmpeg

  HTTP(S) video and audio sources are now passed directly to FFmpeg instead of downloading them first. This reduces memory usage and avoids unnecessary file I/O for streaming media.

- e1a56e6: Fix potential FFmpeg deadlocks by using split/fifo filters for global background

  When multiple segments use the global background, FFmpeg previously created separate filter chains from the same input, requiring it to decode the same frames multiple times. This could cause deadlocks without proper buffering.

  Now the global background is processed once with fps/scale, then split into independent streams with fifo buffers for each segment that needs it.

- Updated dependencies [e67c47a]
  - @effing/effie@0.2.0

## 0.1.2

### Patch Changes

- @effing/effie@0.1.2

## 0.1.1

### Patch Changes

- @effing/effie@0.1.1
