---
"@effing/create": patch
---

Fix service worker cache pruning in the starter template: track insertion order explicitly instead of relying on unspecified `cache.keys()` ordering, and run pruning in the background via `event.waitUntil` to avoid blocking the response.
