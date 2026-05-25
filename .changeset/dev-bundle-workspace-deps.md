---
"@effing/dev": patch
---

Inline workspace deps in effing build to avoid ERR_UNKNOWN_FILE_EXTENSION

`effing build` previously used esbuild's `packages: "external"`, which kept
every dependency unbundled — including pnpm workspace packages. Workspace
packages whose `main` points at raw TypeScript (e.g. `"main": "src/index.ts"`)
then crashed `node dist/server.js` with `ERR_UNKNOWN_FILE_EXTENSION ".ts"`.
Replaced with an explicit external list (`node:*`, `@napi-rs/canvas`); only
node built-ins and the native `.node` binding stay external, everything else
is inlined.
