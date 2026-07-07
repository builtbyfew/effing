---
"@effing/tween": patch
---

Cap default concurrency at `min(os.availableParallelism(), 8)`

Frame callbacks are dominated by synchronous draw work on the JS main thread;
extra concurrency only overlaps the async portions (e.g. native encoding on
libuv's threadpool, which defaults to 4 threads). Benchmarks show throughput
saturates around 4-8 in-flight frames under default settings, while in-order
yielding retains one completed frame buffer per slot — so on many-core hosts
the old default (`os.availableParallelism()`) added peak memory without adding
throughput. Pass `options.concurrency` explicitly to go higher (e.g. together
with a larger `UV_THREADPOOL_SIZE`).
