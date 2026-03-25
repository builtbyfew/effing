---
"@effing/ffs": minor
---

Add onRenderError callback to server context

Callers can now pass an `onRenderError` callback to `createServerContext` to
observe render failures. The callback receives the error, an error code, and
(when available) the effie data and metadata for the failed job.
