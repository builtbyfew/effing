---
"@effing/ffs": patch
---

Fail cleanly when a source or a video stream fails partway

- `GET /render/:id/video` aborts the response when the render fails partway, instead of ending it cleanly as a truncated MP4. When ffmpeg exited with an error mid-stream (a source connection that dropped, say), the error was uncaught and stopped the FFS server. When the render backend's stream failed, the client got a short video that looked complete.
- `proxyBinaryStream` no longer ends the response when the stream fails; it rejects and leaves the response for the caller to abort.
- A warmup fetch whose source fails partway (a dropped connection, or an annie whose fn failed mid-stream) now fails, caching nothing. Before, the error was uncaught, which stopped the FFS server, and the warmup waited forever.
- A source whose download fails partway is reported as a fetch failure that names it, `Failed to fetch <url>: response body failed: terminated`, with code `FETCH_FAILED` (and a 422 from `GET /render/:id/video`), instead of a bare `terminated` with `INTERNAL_ERROR`. The read error is kept as the error's `cause`.
- A source whose download failed before the renderer started reading it no longer raises an uncaught exception, which stopped the FFS server; the render fails instead.
