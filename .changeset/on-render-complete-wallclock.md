---
"@effing/ffs": patch
---

Simplify `onRenderComplete` callback signature from per-phase timings to a single `wallClockTime: number`, fix the hook to fire correctly in all render paths (local direct-stream, backend proxy, and upload mode), and add tests covering every code path including error handling.
