---
"@effing/canvas": patch
---

Fetch remote images via global `fetch()` instead of `@napi-rs/canvas`'s URL loader

`cachedLoadImage` now downloads `http://` and `https://` sources with the global
`fetch()` and passes the resulting bytes to `loadImage`. `@napi-rs/canvas`'s
built-in URL loader uses Node's raw `http`/`https` modules, which bypass any
dispatcher installed via `setGlobalDispatcher` — so consumers that route
outbound traffic through a proxy (e.g. the sandboxed runtime in `effing-cloud`)
could not load remote images. Non-OK responses now throw an error naming the
URL and status. File-path strings and `Buffer` sources are unaffected.
