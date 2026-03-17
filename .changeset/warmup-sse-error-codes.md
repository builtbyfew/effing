---
"@effing/ffs": patch
---

Add error codes to warmup SSE events

The warmup SSE `error` event now includes a `code` field, consistent with render
SSE error events. Also switches validation error responses in `/warmup` and
`/purge` handlers to use `sendError()` for consistency.
