---
"@effing/satori": minor
---

Replace tinypool with a direct `worker_threads` implementation, eliminating the dependency resolution issues when the Vite plugin externalizes tinypool in strict pnpm consumers
