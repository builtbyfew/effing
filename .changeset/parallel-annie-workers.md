---
"@effing/dev": minor
---

Render annies in parallel in `effing dev` and `effing render`

FFS requests all the annies in an effie at once, but the dev server drew them in turns on its main thread. Annies now render on worker threads, started on demand. The new `dev.workers` option caps them (default: one per core less one, at most 8); `0` renders on the main thread as before. Annie props must be structured-cloneable to reach a worker, as JSON-shaped props are.

Frames encode on `@effing/skia`'s own thread pool, which all workers share. With it, `effing render effie` of the starter's six-annie slideshow takes 5.5s instead of 9.3s on an 18-core machine, with identical output.
