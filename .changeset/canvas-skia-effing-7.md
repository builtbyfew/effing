---
"@effing/canvas": minor
---

Update to @effing/skia 1.0.10-effing.7: async encodes on their own threads

- `canvas.encode()` (and `toDataURLAsync()`, `toBlob()`, `convertToBlob()`)
  runs on @effing/skia's own native threads, one per core, instead of
  libuv's threadpool, which has 4 threads unless `UV_THREADPOOL_SIZE` is set
  when Node starts and which every thread in the process shares. As many
  frames now encode at once as there are cores, from the main thread and
  worker threads alike, and `fs`, `dns.lookup`, `zlib` and `crypto` no
  longer wait behind encodes. Set `EFFING_SKIA_THREADS` to size the pool;
  `getEncodeThreads()` from `@effing/skia/extensions` reports it. Encoded
  bytes are unchanged.
- `toBlob()` calls back with `null` when the encode fails, and a callback
  that throws is an uncaught exception, as in browsers; both crashed the
  process before.
