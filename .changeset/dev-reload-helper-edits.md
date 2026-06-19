---
"@effing/dev": patch
---

Reload the dev preview when a non-fn helper module changes

The dev server only nudged the browser on edits to `*.fn.tsx` files: the
watcher's change handler returned early for anything else. Editing a shared
helper that an fn imports — fonts, geometry utils, data modules — invalidated
the SSR module graph but never reloaded the page, so the preview sat stale
until a manual refresh. The change handler now also reloads when the edited
file is a module some rendered fn imports (directly or transitively), detected
via Vite's SSR module graph. Edits to files no render depends on (config,
tests, unused modules) still don't trigger a reload.
