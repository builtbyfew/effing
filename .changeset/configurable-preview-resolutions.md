---
"@effing/create": minor
---

Make preview resolutions configurable via `app/resolutions.ts`

The starter now reads its preview resolution selector and the default bounds
for `parseBoundsFromUrl` from a single `app/resolutions.ts` module, so users
can adjust the considered aspect ratios in one place instead of editing the
effie preview route and the URL parser separately.
