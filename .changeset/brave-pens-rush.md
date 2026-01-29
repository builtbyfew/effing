---
"@effing/ffs": minor
---

Add HTTP proxy for FFmpeg URL handling

Static FFmpeg binaries can have DNS resolution issues on Alpine Linux (musl libc). This adds an HTTP proxy that routes video/audio URLs through localhost, letting Node.js handle DNS lookups instead of FFmpeg.

- Add `HttpProxy` class with `start()`, `transformUrl()`, and `close()` methods
- Make `createServerContext()` async to ensure proxy is ready before handling requests
- Pass `httpProxy` to `EffieRenderer` which transforms URLs via `urlTransformer` callback
