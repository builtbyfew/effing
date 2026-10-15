---
"@effing/dev": minor
---

Serve the dev app on worker threads, so the annies of an effie render in parallel

FFS fetches all the annies in an effie at once, but the dev server drew them in turns on its one thread. `effing dev` and `effing render` now serve requests on worker threads, started on demand up to the new `dev.workers` option (default: one per core less one, at most 8, and `0` below 3 cores; `0` serves everything on the main thread as before). Each worker evaluates fns on its own, so module-level state isn't shared between requests served by different workers, and each busy worker holds its own copy of the app, the fns and their canvas and font state, so lower `dev.workers` to save memory.
