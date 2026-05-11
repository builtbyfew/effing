---
"@effing/dev": minor
"@effing/fn": minor
"@effing/create": minor
---

Add `@effing/dev` — a CLI (`effing dev`, `effing build`) and Vite-based dev server for Effing projects. Reads a new `effing.config.ts` schema. The starter now contains only fn files, fonts, and config; the dev server owns the preview UI and signed-URL endpoints.

The preview app uses React Router 7 internally, but its deps (`react-router`, `@react-router/dev`, `@react-router/node`, `isbot`, `react-dom`, `@effing/annie-player`, `@effing/effie-preview`, `tiny-invariant`) are kept off the user's `package.json` — at dev start the server symlink-hoists them from `@effing/dev`'s own tree into the user's `node_modules`, and cleans them up on shutdown. The user's deps stay minimal: just the `@effing/*` packages their fns import plus `react`, `tiny-invariant`, and `zod`.

`effing build` produces a self-contained Node server at `dist/server.js` that exposes the three signed-segment routes via `@effing/fn/server`'s `createFnHttpListener` — no preview UI, no React Router, no Vite at runtime. Run with `node dist/server.js`.

Also adds a new `@effing/fn/server` subpath export with shared primitives — `signFnSegment`, `verifyFnSegment`, `validateBounds`, `createUrlBuilder`, `createFlatUrlBuilder`, `pipeWebResponse`, `createFnHttpListener` — usable by both the self-host server and Effing Cloud's fn runner. Signed-segment wire format is `{ id, props, bounds: { width, height } }` (nested bounds).
