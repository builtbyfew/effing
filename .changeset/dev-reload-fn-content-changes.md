---
"@effing/dev": patch
---

Reload preview pages when fn file contents change

The chokidar watcher only handled `add` and `unlink` events, so editing an existing `*.fn.tsx` left the SSR module cache stale and the browser showing the old render. Add a `change` handler that invalidates the file's entries in Vite's `moduleGraph` (via `getModulesByFile`) and broadcasts `full-reload`.
