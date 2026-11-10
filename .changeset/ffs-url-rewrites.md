---
"@effing/ffs": minor
---

Add `FFS_URL_REWRITES`, which sends outbound fetches for configured URL prefixes to another address (e.g. a service's internal URL instead of its public one behind a CDN), while cache keys, events and errors keep the original URL.
