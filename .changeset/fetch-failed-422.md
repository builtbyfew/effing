---
"@effing/ffs": patch
---

Change `FETCH_FAILED` error status from 502 to 422 so CDNs treat it as a client error instead of an origin failure.
