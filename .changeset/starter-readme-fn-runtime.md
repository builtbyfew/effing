---
"@effing/create": patch
---

Update starter README to match the current fn runtime

The starter's README still described the old `*.annie.tsx`/`*.effie.tsx`
modules with `AnnieRendererArgs`/`EffieRendererArgs` and an `annieUrl`
helper. It now documents the unified `*.fn.tsx` modules with a `runner`
typed via `RunnerArgs` from `@effing/fn`, including a Creating Images
section and a rewritten URL Generation section around `fnUrl`.
