/* global clients */

// FFS render URLs (GET /render/{uuid}) are one-time-consumption — the server
// deletes the job after streaming the response. However, browsers might make
// follow-up requests to the same URL (e.g. to re-read the moov atom for seeking),
// which return 404 and cause the video to break. This service worker caches the
// response so those subsequent requests are served from cache.

const CACHE_NAME = "ffs-render-cache";
const RENDER_URL_PATTERN = /\/render\/[0-9a-f-]{36}\/video$/;
const MAX_ENTRIES = 5;

/** @type {string[]} URLs in insertion order — reset on activate alongside the cache. */
const cacheOrder = [];

self.addEventListener("activate", (event) => {
  cacheOrder.length = 0;
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
        cacheOrder.push(event.request.url);

        // Prune oldest entries in the background — don't block the response.
        if (cacheOrder.length > MAX_ENTRIES) {
          const toDelete = cacheOrder.splice(
            0,
            cacheOrder.length - MAX_ENTRIES,
          );
          event.waitUntil(
            Promise.all(toDelete.map((url) => cache.delete(url))),
          );
        }
      }
      return response;
    }),
  );
});
