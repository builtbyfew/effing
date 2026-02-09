---
"@effing/create": patch
"@effing/effie-preview": patch
---

Add a service worker to the starter demo that caches FFS render responses, preventing re-fetch failures when the browser revisits one-time-consumption render URLs. Also add `crossOrigin="anonymous"` to the `EffieCoverPreview` video element.
