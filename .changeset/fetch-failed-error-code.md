---
"@effing/ffs": patch
---

Return FETCH_FAILED error code when remote Effie URL fetch fails

When `createRenderJob` receives a string URL for `body.effie` and the fetch fails (network error or non-OK response), the endpoint now returns HTTP 502 with `ErrorCode.FETCH_FAILED` instead of falling through to the generic 500 `INTERNAL_ERROR` catch-all. This lets clients distinguish "your URL was unreachable" from "something broke internally."
