---
"@effing/ffs": minor
---

Surface fetch errors in HTTP API

Source URL fetch failures now return a `422` status with error code `FETCH_FAILED`
(instead of a generic `500 INTERNAL_ERROR`) on the `/render/:id/video` endpoint.
The render progress SSE `error` event now includes a `code` field (`FETCH_FAILED`
or `INTERNAL_ERROR`) and preserves the original error message with URL and status
details.
