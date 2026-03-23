# @effing/ffs

## 0.24.7

### Patch Changes

- @effing/effie@0.24.7

## 0.24.6

### Patch Changes

- @effing/effie@0.24.6

## 0.24.5

### Patch Changes

- @effing/effie@0.24.5

## 0.24.4

### Patch Changes

- @effing/effie@0.24.4

## 0.24.3

### Patch Changes

- @effing/effie@0.24.3

## 0.24.2

### Patch Changes

- @effing/effie@0.24.2

## 0.24.1

### Patch Changes

- @effing/effie@0.24.1

## 0.24.0

### Patch Changes

- @effing/effie@0.24.0

## 0.23.2

### Patch Changes

- @effing/effie@0.23.2

## 0.23.1

### Patch Changes

- @effing/effie@0.23.1

## 0.23.0

### Patch Changes

- @effing/effie@0.23.0

## 0.22.3

### Patch Changes

- @effing/effie@0.22.3

## 0.22.2

### Patch Changes

- @effing/effie@0.22.2

## 0.22.1

### Patch Changes

- @effing/effie@0.22.1

## 0.22.0

### Patch Changes

- @effing/effie@0.22.0

## 0.21.1

### Patch Changes

- @effing/effie@0.21.1

## 0.21.0

### Minor Changes

- 2d0cb86: Surface fetch errors in HTTP API

  Source URL fetch failures now return a `422` status with error code `FETCH_FAILED`
  (instead of a generic `500 INTERNAL_ERROR`) on the `/render/:id/video` endpoint.
  The render progress SSE `error` event now includes a `code` field (`FETCH_FAILED`
  or `INTERNAL_ERROR`) and preserves the original error message with URL and status
  details.

### Patch Changes

- 0c45351: Add error codes to warmup SSE events

  The warmup SSE `error` event now includes a `code` field, consistent with render
  SSE error events. Also switches validation error responses in `/warmup` and
  `/purge` handlers to use `sendError()` for consistency.
  - @effing/effie@0.21.0

## 0.20.1

### Patch Changes

- @effing/effie@0.20.1

## 0.20.0

### Patch Changes

- @effing/effie@0.20.0

## 0.19.3

### Patch Changes

- @effing/effie@0.19.3

## 0.19.2

### Patch Changes

- @effing/effie@0.19.2

## 0.19.1

### Patch Changes

- @effing/effie@0.19.1

## 0.19.0

### Patch Changes

- @effing/effie@0.19.0

## 0.18.6

### Patch Changes

- @effing/effie@0.18.6

## 0.18.5

### Patch Changes

- @effing/effie@0.18.5

## 0.18.4

### Patch Changes

- @effing/effie@0.18.4

## 0.18.3

### Patch Changes

- @effing/effie@0.18.3

## 0.18.2

### Patch Changes

- @effing/effie@0.18.2

## 0.18.1

### Patch Changes

- @effing/effie@0.18.1

## 0.18.0

### Patch Changes

- @effing/effie@0.18.0

## 0.17.1

### Patch Changes

- 8cdb6be: Simplify `onRenderComplete` callback signature from per-phase timings to a single `wallClockTime: number`, fix the hook to fire correctly in all render paths (local direct-stream, backend proxy, and upload mode), and add tests covering every code path including error handling.
  - @effing/effie@0.17.1

## 0.17.0

### Minor Changes

- 686ddfb: feat(ffs): add `onRenderComplete` callback hook with per-phase timings

### Patch Changes

- @effing/effie@0.17.0

## 0.16.0

### Minor Changes

- b5a388b: Add optional `timings` parameter to `createRenderJob`, `createWarmupJob`, and `purgeCache` handlers for measuring operation durations
- 06949ba: Deferred Effie URL fetching: when `effie` is a URL string, the fetch is deferred to the SSE progress stream with `effie:fetching`/`effie:fetched` events. Introduces `ResolvedRenderJob` and `DeferredRenderJob` types (exported). Also renames keepalive phase `"uploading"` to `"upload"` for consistency, and adds `"upload"` to the error event's phase union so upload failures report the correct phase.

### Patch Changes

- @effing/effie@0.16.0

## 0.15.1

### Patch Changes

- adc5abd: Change `FETCH_FAILED` error status from 502 to 422 so CDNs treat it as a client error instead of an origin failure.
  - @effing/effie@0.15.1

## 0.15.0

### Patch Changes

- @effing/effie@0.15.0

## 0.14.1

### Patch Changes

- @effing/effie@0.14.1

## 0.14.0

### Patch Changes

- @effing/effie@0.14.0

## 0.13.1

### Patch Changes

- 1aaa59b: Add `default_base_moof` movflag to fragmented MP4 output for broader player compatibility
  - @effing/effie@0.13.1

## 0.13.0

### Patch Changes

- @effing/effie@0.13.0

## 0.12.0

### Patch Changes

- @effing/effie@0.12.0

## 0.11.2

### Patch Changes

- @effing/effie@0.11.2

## 0.11.1

### Patch Changes

- @effing/effie@0.11.1

## 0.11.0

### Patch Changes

- @effing/effie@0.11.0

## 0.10.5

### Patch Changes

- @effing/effie@0.10.5

## 0.10.4

### Patch Changes

- @effing/effie@0.10.4

## 0.10.3

### Patch Changes

- @effing/effie@0.10.3

## 0.10.2

### Patch Changes

- @effing/effie@0.10.2

## 0.10.1

### Patch Changes

- @effing/effie@0.10.1

## 0.10.0

### Patch Changes

- @effing/effie@0.10.0

## 0.9.0

### Minor Changes

- 5b96977: Accept raw EffieData as request body for /render, /warmup, and /purge

  All three endpoints now accept raw `EffieData` directly as the JSON body, in addition to the existing wrapped `{ effie: ... }` format. When using the raw format, `scale` and `purge` can be passed as query parameters (`?scale=0.5&purge=true`). The starter demo has been updated to use the raw format, eliminating unnecessary parse/re-stringify round-trips.

### Patch Changes

- 026c78e: Return FETCH_FAILED error code when remote Effie URL fetch fails

  When `createRenderJob` receives a string URL for `body.effie` and the fetch fails (network error or non-OK response), the endpoint now returns HTTP 502 with `ErrorCode.FETCH_FAILED` instead of falling through to the generic 500 `INTERNAL_ERROR` catch-all. This lets clients distinguish "your URL was unreachable" from "something broke internally."
  - @effing/effie@0.9.0

## 0.8.0

### Minor Changes

- 3008ef2: Consolidate SSE event types to reduce stringly-typed event drift

  Export `WarmupEventMap`, `RenderEventMap`, and typed sender utilities from a new `@effing/ffs/sse` entrypoint. Replace the untyped `SSEEventSender` with a generic `TypedEventSender<TMap>` so `createEventSender` and `prefixEventSender` enforce correct payloads per event name at compile time. A plain `EventSender` remains for wire boundaries like `proxyRemoteSSE`.

  On the client in `@effing/effie-preview`, derive `EffieWarmupEvent` from `WarmupEventMap` via a mapped type and normalise all variants to `{ type, data }` so the client union stays in sync with the server automatically.

- 0922e98: Unify HTTP error responses with machine-readable error codes

  All JSON error responses now include a `code` field with a machine-readable identifier (`UNAUTHORIZED`, `INVALID_EFFIE`, `NOT_FOUND`, `BACKEND_FAILED`, `FETCH_FAILED`, `INTERNAL_ERROR`). The `error` and `issues` fields are unchanged, so existing consumers are not affected. New `ApiError` type and `sendError` helper are exported from `@effing/ffs/handlers`.

### Patch Changes

- 893a38c: Enable HTTP proxy by default even when render backend resolver is configured

  Previously, configuring a `renderBackendResolver` implicitly disabled the HTTP proxy. This caused local-fallback jobs (where the resolver returns `null`) to lose proxy URL transformation. The proxy now starts by default regardless of resolver presence; pass `httpProxy: false` to explicitly disable it.

- 893a38c: Close `EffieRenderer` in `renderAndUploadInternal` on failure

  `EffieRenderer` was not closed if rendering or upload threw, leaving ffmpeg resources alive longer than intended. Wrap render/upload in `try/finally` so `renderer.close()` runs unconditionally.

- 893a38c: Preserve SSE parser state across chunks in `proxyRemoteSSE`

  `currentEvent`/`currentData` were reinitialized on every read chunk, so SSE events whose terminating blank line arrived in a subsequent chunk were silently dropped. Move parser state outside the read loop so events spanning chunk boundaries are correctly forwarded.

- 893a38c: Drain non-frame tar entries during Annie extraction

  Non-frame tar entries (e.g. directory entries, metadata) were not drained or advanced, which could stall extraction. Now these entries are resumed and skipped.

- 01a7bce: Pass metadata to render backend resolver in `streamRenderVideo`

  The `renderBackendResolver` in `streamRenderVideo` was called without the `metadata` argument, so backend routing decisions that depend on metadata would fail. `VideoJob` now carries `metadata` and all call sites pass it through.
  - @effing/effie@0.8.0

## 0.7.3

### Patch Changes

- 6008f66: fix(ffs): fix S3 transient store key construction

  `S3TransientStore.getFullKey` now joins prefix and key with `/` instead of concatenating them directly. The prefix is also normalized to strip trailing slashes on construction.
  - @effing/effie@0.7.3

## 0.7.2

### Patch Changes

- 18c7496: fix(ffs): fix segment background scaling, data-URL cover upload, and store deletion ordering
  - Segment backgrounds now use `force_original_aspect_ratio=increase,crop=WxH` matching global backgrounds, preventing aspect ratio distortion
  - Cover image upload handles `data:` URLs inline instead of passing them to `ffsFetch` with an undici `Agent` dispatcher
  - Render job is now deleted from the transient store only after confirming it exists
  - @effing/effie@0.7.2

## 0.7.1

### Patch Changes

- 0a96fc7: Fix render backend proxy in the `/render` endpoints:
  - Upload mode with a render backend now fetches the binary video from the backend's `/render/:id/video` and uploads it locally, instead of proxying SSE to `/render/:id/progress` which would re-run the full orchestration on the backend.
  - `streamRenderVideo` no longer deletes the `VideoJob` before proxying to a render backend, fixing 404s on the backend side.
  - Extracted reusable `uploadRenderedVideo` helper from `renderAndUploadInternal` for sharing between local and backend render+upload flows.
  - @effing/effie@0.7.1

## 0.7.0

### Minor Changes

- 7ad0a15: Revamp FFS server API: consolidate warmup-and-render into a single `/render` endpoint that always includes warmup. Contains breaking changes (acceptable during early unstable project phase).
  - `POST /render` now creates a combined warmup+render job and returns `{ id, progressUrl }`.
  - `GET /render/:id/progress` streams SSE with `warmup:*`/`render:*` events. Non-upload mode emits `ready` with `{ videoUrl }`.
  - `GET /render/:id/video` serves the rendered MP4. Returns 404 until warmup completes.
  - `POST /warmup` response changed to `{ id, progressUrl }`. Progress stream moved to `GET /warmup/:id/progress`.
  - `POST /render` accepts a `purge` option to purge cached sources before warmup.
  - Removed `POST /warmup-and-render`, `GET /warmup-and-render/:id`, and standalone `GET /render/:id`.
  - Unified storage TTLs: single `ttlMs` property and `FFS_TRANSIENT_STORE_TTL_MS` env var replace the previous `sourceTtlMs`/`jobDataTtlMs` split.
  - Removed `WarmupAndRenderJob` type; `RenderJob` now includes warmup fields. Added `VideoJob` type.

### Patch Changes

- @effing/effie@0.7.0

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
