---
"@effing/ffs": patch
---

Add `Cache-Control: public, immutable, max-age=86400` header to render responses

Render jobs are deleted before streaming starts, so follow-up requests to the
same URL return 404. The new header lets intermediate cache layers retain the
response, complementing the client-side service-worker cache in the starter demo.
