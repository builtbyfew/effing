---
"@effing/ffs": patch
---

Add `FFS_URL_REWRITES`, which sends outbound fetches for configured origins to another origin (e.g. a service's internal URL instead of its public one behind a CDN), while cache keys, events and errors keep the original URL.
