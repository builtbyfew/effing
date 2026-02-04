---
"@effing/ffs": minor
---

Add unified `/warmup-and-render` endpoint that combines warmup and render into a single SSE stream

- New `POST /warmup-and-render` endpoint creates a combined job
- New `GET /warmup-and-render/:id` streams progress for both phases with prefixed events (`warmup:*`, `render:*`)
- Add backend separation support via `FFS_WARMUP_BACKEND_BASE_URL` and `FFS_RENDER_BACKEND_BASE_URL` environment variables
