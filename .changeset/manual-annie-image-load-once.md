---
"@effing/dev": patch
"@effing/canvas": patch
---

Document that renderReactElement re-fetches image sources on every call

`renderReactElement` creates a fresh internal image cache per call, so `<img>`
and `background-image: url(...)` sources in a per-frame tree are re-fetched and
re-decoded on every frame — a silent ~24× slowdown in a measured case. The
manual's "Creating Annies" section now warns about this and shows the
load-once pattern (pre-load with `loadImage()`, draw with `ctx.drawImage`,
keep the per-frame React tree to text and vectors); the `@effing/canvas`
README carries the same warning next to `renderReactElement`.
