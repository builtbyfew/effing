---
"@effing/dev": minor
"@effing/create": patch
---

Pre-build dev preview app and drop staging-dir + hoisted-symlinks workaround

`effing dev` now ships a pre-built React Router preview app and loads user fn
files via Vite's `createServerModuleRunner`. The dev server no longer creates
a `.effing-preview/` staging directory in the user's project or symlinks
framework dependencies into their `node_modules`. Browser reload on fn edits
uses an SSE channel (`/__effing/reload`) instead of Vite HMR. The unused
`@effing/dev/vite` subpath export has been removed.

**Breaking config change:** the preview-resolutions array has moved from the
top level of `effing.config.ts` to `dev.resolutions`, since it only affects
the dev preview's resolution picker. Projects that set `resolutions: [...]`
at the top level should move it under `dev: { resolutions: [...] }`. The
starter template now spells out every `dev.*` key with its default value as
an illustrative reference.
