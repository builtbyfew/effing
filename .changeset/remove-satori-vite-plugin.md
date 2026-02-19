---
"@effing/satori": minor
"@effing/create": minor
---

Remove `satoriPoolPlugin` Vite plugin in favor of resolving the worker file from `node_modules` at runtime via `import.meta.resolve`, falling back to relative URL resolution in Vite dev
