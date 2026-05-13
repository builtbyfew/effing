# @effing/dev

## 0.34.0

### Minor Changes

- b4ad6b3: Pre-build dev preview app and drop staging-dir + hoisted-symlinks workaround

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

- 3f03f6e: Redesign dev server UI with sticky breadcrumb header

  Adds a Nunito Sans typeface and the salad/coal/tomato design system. The
  sticky header carries a breadcrumb — effing logo / project / kind / fn id /
  resolution dropdown — that replaces the per-page title block, with the
  resolution picker and render-scale dropdown sharing a reusable Select. The
  overview moves to /preview (with / redirecting), and the project name from
  effing.config.ts is plumbed through to the UI.

- e1e6e5e: Add `@effing/dev` — a CLI (`effing dev`, `effing build`) and Vite-based dev server for Effing projects. Reads a new `effing.config.ts` schema. The starter now contains only fn files, fonts, and config; the dev server owns the preview UI and signed-URL endpoints.

  The preview app uses React Router 7 internally, but its deps (`react-router`, `@react-router/dev`, `@react-router/node`, `isbot`, `react-dom`, `@effing/annie-player`, `@effing/effie-preview`, `tiny-invariant`) are kept off the user's `package.json` — at dev start the server symlink-hoists them from `@effing/dev`'s own tree into the user's `node_modules`, and cleans them up on shutdown. The user's deps stay minimal: just the `@effing/*` packages their fns import plus `react`, `tiny-invariant`, and `zod`.

  `effing build` produces a self-contained Node server at `dist/server.js` that exposes the three signed-segment routes via `@effing/fn/server`'s `createFnHttpListener` — no preview UI, no React Router, no Vite at runtime. Run with `node dist/server.js`.

  Also adds a new `@effing/fn/server` subpath export with shared primitives — `signFnSegment`, `verifyFnSegment`, `validateBounds`, `createUrlBuilder`, `createFlatUrlBuilder`, `pipeWebResponse`, `createFnHttpListener` — usable by both the self-host server and Effing Cloud's fn runner. Signed-segment wire format is `{ id, props, bounds: { width, height } }` (nested bounds).

- a5dea3a: Add `effing manual` command

  The new `effing manual` CLI prints a tool-level reference for the `effing` CLI and the fn module shape, tailored to the project's configured globs, default resolution, and detected package manager. Commands in the manual use each PM's local-only invocation form — `pnpm exec` / `yarn` / `npx --no` for the three recognized ones, and `./node_modules/.bin/effing` as a safe fallback for bun and anything else — so a copy-pasted command never falls back to fetching the unrelated `effing` package from the npm registry. The starter's `AGENTS.md` now directs agents to run it before touching any fn, and `GUIDE.md` is trimmed to project-specific conventions (path alias, font helpers, package.json scripts, deploying) — removing the staleness risk of the previously-static manual scaffolded once at project creation.

- 18656b8: Add `effing url` command for minting signed fn URLs

  The new `effing url <kind> <id>` CLI prints a signed fn URL for the given props, reading `BASE_URL` and `SECRET_KEY` from the project's `.env`. Useful for agents or `curl` fetching a specific propped variant from the dev or production server without going through the HTML preview pages. Width and height default to the first entry in `dev.resolutions`. The starter template wires it up as `npm run url`.

### Patch Changes

- eb52e70: Bundle the dev-server favicon with `@effing/dev` and drop user-public-dir support

  The favicon shown in the local dev-server browser tab is now shipped as
  branding inside `@effing/dev` rather than something each project has to
  carry. The previously unused user `public/` directory branch in the dev
  server has been removed, and the starter template no longer includes a
  `public/` directory (production servers built by `effing build` never
  served those files).

- a59bd41: Reload preview pages when fn file contents change

  The chokidar watcher only handled `add` and `unlink` events, so editing an existing `*.fn.tsx` left the SSR module cache stale and the browser showing the old render. Add a `change` handler that invalidates the file's entries in Vite's `moduleGraph` (via `getModulesByFile`) and broadcasts `full-reload`.

- Updated dependencies [e1e6e5e]
  - @effing/fn@0.34.0
  - @effing/effie@0.34.0
  - @effing/serde@0.34.0
  - @effing/annie-player@0.34.0
  - @effing/effie-preview@0.34.0
