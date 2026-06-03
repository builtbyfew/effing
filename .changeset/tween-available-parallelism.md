---
"@effing/tween": patch
---

Use os.availableParallelism() for default concurrency

The default concurrency now derives from `os.availableParallelism()` instead of
`os.cpus().length`, so it respects cgroup CPU quotas and CPU affinity. This
avoids over-subscribing worker tasks when running inside a CPU-limited container.
