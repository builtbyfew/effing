---
"@effing/ffs": minor
---

Accept raw EffieData as request body for /render, /warmup, and /purge

All three endpoints now accept raw `EffieData` directly as the JSON body, in addition to the existing wrapped `{ effie: ... }` format. When using the raw format, `scale` and `purge` can be passed as query parameters (`?scale=0.5&purge=true`). The starter demo has been updated to use the raw format, eliminating unnecessary parse/re-stringify round-trips.
