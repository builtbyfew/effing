---
"@effing/ffs": patch
---

Reuse undici connection pools across fetches and kill ffmpeg when a client aborts a direct-stream download

`ffsFetch` now caches undici Agents per timeout config instead of creating a
new connection pool on every call, enabling keep-alive connection reuse and
avoiding orphaned sockets. Direct video streaming now settles its response
promise when the client disconnects mid-download, so the renderer is always
closed and the spawned ffmpeg process (and its temp dir) no longer leaks on
aborted downloads.
