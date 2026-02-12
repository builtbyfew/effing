---
"@effing/ffs": minor
---

Revamp FFS server API: consolidate warmup-and-render into a single `/render` endpoint that always includes warmup. Contains breaking changes (acceptable during early unstable project phase).

- `POST /render` now creates a combined warmup+render job and returns `{ id, progressUrl }`.
- `GET /render/:id/progress` streams SSE with `warmup:*`/`render:*` events. Non-upload mode emits `ready` with `{ videoUrl }`.
- `GET /render/:id/video` serves the rendered MP4. Returns 404 until warmup completes.
- `POST /warmup` response changed to `{ id, progressUrl }`. Progress stream moved to `GET /warmup/:id/progress`.
- `POST /render` accepts a `purge` option to purge cached sources before warmup.
- Removed `POST /warmup-and-render`, `GET /warmup-and-render/:id`, and standalone `GET /render/:id`.
- Unified storage TTLs: single `ttlMs` property and `FFS_TRANSIENT_STORE_TTL_MS` env var replace the previous `sourceTtlMs`/`jobDataTtlMs` split.
- Removed `WarmupAndRenderJob` type; `RenderJob` now includes warmup fields. Added `VideoJob` type.
