---
"@effing/ffs": minor
---

Unify HTTP error responses with machine-readable error codes

All JSON error responses now include a `code` field with a machine-readable identifier (`UNAUTHORIZED`, `INVALID_EFFIE`, `NOT_FOUND`, `BACKEND_FAILED`, `FETCH_FAILED`, `INTERNAL_ERROR`). The `error` and `issues` fields are unchanged, so existing consumers are not affected. New `ApiError` type and `sendError` helper are exported from `@effing/ffs/handlers`.
