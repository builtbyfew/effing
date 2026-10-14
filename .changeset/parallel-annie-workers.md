---
"@effing/dev": minor
---

Render annies on worker threads in `effing dev` and `effing render`

FFS requests all the annies in an effie at once, but the dev server drew them in turns on its main thread. Annies now render on worker threads, started on demand. The new `dev.workers` option caps them (default: one per core less one, at most 8); `0` renders on the main thread as before.

An annie's parsed props must be plain data to reach a worker (objects, arrays, primitives, `Date`, `Map`, `Set`, `RegExp`, typed arrays); props that hold class instances, functions or `Buffer`s get an error naming the prop.

Frames still encode on a thread pool all workers share, libuv's 4 threads with the current `@effing/skia`, which limits the speed-up for now.
