# @effing/ffs

## 0.6.1

### Patch Changes

- 9909d44: Add `Cache-Control: public, immutable, max-age=86400` header to render responses

  Render jobs are deleted before streaming starts, so follow-up requests to the
  same URL return 404. The new header lets intermediate cache layers retain the
  response, complementing the client-side service-worker cache in the starter demo.
  - @effing/effie@0.6.1

## 0.6.0

### Minor Changes

- 2457a17: Replace static backend env vars with dynamic resolver callbacks

  Backend routing is now configured via `warmupBackendResolver` and
  `renderBackendResolver` callbacks passed to `createServerContext`, instead of
  the removed `FFS_WARMUP_BACKEND_BASE_URL`, `FFS_RENDER_BACKEND_BASE_URL`,
  `FFS_WARMUP_BACKEND_API_KEY`, and `FFS_RENDER_BACKEND_API_KEY` env vars.
  Resolvers receive the job's effie data (or sources) and optional metadata,
  and return a `BackendConfig` or `null` to handle locally. Job creation
  handlers (`createRenderJob`, `createWarmupJob`, `createWarmupAndRenderJob`)
  accept an optional `metadata` parameter stored with the job and forwarded to
  resolvers. `createServerContext` also accepts an explicit `httpProxy` flag
  (defaults to `true` when no render resolver is set). Renamed
  `FFS_JOB_METADATA_TTL_MS` to `FFS_JOB_DATA_TTL_MS` and `jobMetadataTtlMs`
  to `jobDataTtlMs` on the `TransientStore` interface.

### Patch Changes

- @effing/effie@0.6.0

## 0.5.0

### Minor Changes

- eb0ab07: Make @effing/ffmpeg an optional dependency for @effing/ffs
  - Move @effing/ffmpeg from dependencies to optionalDependencies so FFS can start without it (falls back to system `ffmpeg`)
  - Lazily resolve the FFmpeg binary at render time via dynamic `await import()` instead of importing at module load
  - Lazily import `EffieRenderer` in render handlers to avoid loading FFmpeg modules at startup
  - Make `httpProxy` optional in `ServerContext` to support external render backends
  - Remove `getFFmpegVersion()` startup log (depended on synchronous binary resolution)
  - Mark @effing/ffmpeg as external in tsup config to preserve correct `import.meta.url` path resolution

### Patch Changes

- 3637c87: Add `@effing/ffmpeg` package for self-managed FFmpeg binaries
  - New workspace package that downloads FFmpeg 6.0 binaries at install time from ffmpeg-static GitHub releases
  - Replace third-party `ffmpeg-static` dependency in `@effing/ffs` with `@effing/ffmpeg`
  - @effing/effie@0.5.0

## 0.4.1

### Patch Changes

- 93b824f: Print FFmpeg version on FFS startup
  - Log the FFmpeg version string at server boot for easier debugging
  - Centralize FFmpeg binary path resolution into a module-level constant
  - @effing/effie@0.4.1

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
  - New `FFS_JOB_DATA_TTL_MS` environment variable for job data (default: 8 hours)
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
