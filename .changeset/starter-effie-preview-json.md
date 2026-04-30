---
"@effing/create": minor
---

Add JSON endpoint for effie previews

Exposes the rendered preview JSON for an effie at `/preview/effie/:effieId.json`
so that agents can fetch effies (and follow the signed annie/image URLs they
contain) without scraping the HTML preview page or signing their own URL
segments. Also factors a shared `parseBounds` helper used by all preview routes,
which validates the `?w` and `?h` query params (replacing an unvalidated
`parseInt` that could pass NaN through to the runner).
