---
"@effing/ffs": minor
---

Add `ffs render` CLI for direct video rendering

The `ffs` binary now supports a `render <url-or-json-file> <output.mp4>` subcommand that fetches an Effie composition (URL or local JSON), validates it, and renders to an MP4 file without going through the HTTP server. The previous default behavior (starting the HTTP server) is preserved and also available as `ffs serve`. As part of this, the binary entry moved from `dist/server.js` to `dist/cli.js` and the `./server` subpath export was removed (it had no known consumers).
