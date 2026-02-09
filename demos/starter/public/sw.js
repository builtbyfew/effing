/* global clients */

// FFS render URLs (GET /render/{uuid}) are one-time-consumption — the server
// deletes the job after streaming the response. However, Chrome makes follow-up
// requests to the same URL (e.g. to re-read the moov atom for seeking), which
// return 404 and cause the video to hang at larger scales. This service worker
// caches the response so those subsequent requests are served from cache.

const CACHE_NAME = "ffs-render-cache";
const RENDER_URL_PATTERN = /\/render\/[0-9a-f-]{36}$/;
const MAX_ENTRIES = 5;

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete(CACHE_NAME).then(() => clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (!RENDER_URL_PATTERN.test(new URL(event.request.url).pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());

        // Prune oldest entries to keep the cache bounded.
        const keys = await cache.keys();
        if (keys.length > MAX_ENTRIES) {
          await Promise.all(
            keys
              .slice(0, keys.length - MAX_ENTRIES)
              .map((k) => cache.delete(k)),
          );
        }
      }
      return response;
    }),
  );
});
