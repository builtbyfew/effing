---
"@effing/ffs": minor
---

Deferred Effie URL fetching: when `effie` is a URL string, the fetch is deferred to the SSE progress stream with `effie:fetching`/`effie:fetched` events. Introduces `ResolvedRenderJob` and `DeferredRenderJob` types (exported). Also renames keepalive phase `"uploading"` to `"upload"` for consistency, and adds `"upload"` to the error event's phase union so upload failures report the correct phase.
