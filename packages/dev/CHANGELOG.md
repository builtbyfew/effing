# @effing/dev

## 0.38.0

### Patch Changes

- d199dbc: Add `options.imageCache` to `renderReactElement` for persistent image caching

  By default each `renderReactElement` call creates a fresh image cache, so
  every `<img>` / `background-image: url(...)` source is re-fetched and
  re-decoded per call — a silent performance cliff when rendering per frame.
  Callers can now pass a persistent cache (`new Map()`, exported type
  `ImageCache`) so each source is loaded once, on first use. Sharing one cache
  across concurrent calls is safe: entries are load promises, so concurrent
  renders share a single in-flight fetch. `cachedLoadImage` now also evicts
  failed loads instead of caching the rejection, so a transient network error
  no longer poisons a long-lived cache. The manual's "Creating Annies" section
  documents the option as the simplest fix for per-frame image fetching.

- d199dbc: Document that renderReactElement re-fetches image sources on every call

  `renderReactElement` creates a fresh internal image cache per call, so `<img>`
  and `background-image: url(...)` sources in a per-frame tree are re-fetched and
  re-decoded on every frame — a silent ~24× slowdown in a measured case. The
  manual's "Creating Annies" section now warns about this and shows the
  load-once pattern (pre-load with `loadImage()`, draw with `ctx.drawImage`,
  keep the per-frame React tree to text and vectors); the `@effing/canvas`
  README carries the same warning next to `renderReactElement`.
  - @effing/effie-preview@0.38.0
  - @effing/effie@0.38.0
  - @effing/fn@0.38.0
  - @effing/serde@0.38.0
  - @effing/annie-player@0.38.0

## 0.37.1

### Patch Changes

- @effing/effie@0.37.1
- @effing/fn@0.37.1
- @effing/serde@0.37.1
- @effing/annie-player@0.37.1
- @effing/effie-preview@0.37.1

## 0.37.0

### Minor Changes

- b00f33d: Make running multiple dev servers side by side work out of the box

  `effing dev` now handles port collisions instead of crashing with a raw
  EADDRINUSE: when no port was chosen explicitly, it walks up from 3839 to the
  next free port; explicitly chosen ports (`--port` or `dev.port`) stay strict
  and fail fast with a clear message. Everything downstream follows the chosen
  port automatically — `BASE_URL` defaults to the dev server's own address when
  unset (with a startup warning when a stale localhost `BASE_URL` points at a
  different port), each instance's FFS sidecar gets its own free port (starting
  at 2000) with `FFS_BASE_URL` auto-set to match, and `effing url` defaults
  `BASE_URL` to the configured dev address. The preview's FFS flows no longer
  require `FFS_API_KEY` — the auth header is only sent when a key is set,
  matching the sidecar, which doesn't enforce auth without one. Vite's unused
  HMR WebSocket server (a hidden cross-instance collision on port 24678) is now
  disabled. The starter template's `.env.example` and guide reflect the new
  defaults: only `SECRET_KEY` is required in development.

### Patch Changes

- @effing/effie@0.37.0
- @effing/fn@0.37.0
- @effing/serde@0.37.0
- @effing/annie-player@0.37.0
- @effing/effie-preview@0.37.0

## 0.36.2

### Patch Changes

- 9100543: Prefix downloaded effie videos with the project name

  The "Download video" link on the effie preview page now names the file
  `<project>-<effieId>-<width>x<height>.mp4` instead of just
  `<effieId>-<width>x<height>.mp4`, so renders from different projects no longer
  share an indistinguishable filename. The project name is slugified
  (non-alphanumeric runs collapse to `-`, with leading/trailing hyphens trimmed)
  and the prefix is omitted entirely when the project name is empty.

- 054aed5: Point the manual at `ffs render` for full-composition renders

  The `effing manual` now surfaces the `@effing/ffs` render CLI: the
  "Inspecting from an agent" render step and the CLI commands table both show
  `ffs render <effie-json-or-url> <out.mp4>` as the straightforward way to turn an
  effie into an MP4 — point it at a `/preview/effie/:id.json` URL, a signed
  `/effie/:segment` URL, or a saved JSON file — instead of driving the FFS HTTP
  API by hand. Commands stay tailored to the detected package manager.
  - @effing/effie-preview@0.36.2
  - @effing/effie@0.36.2
  - @effing/fn@0.36.2
  - @effing/serde@0.36.2
  - @effing/annie-player@0.36.2

## 0.36.1

### Patch Changes

- 6201b3a: Guide agents to inspect effie JSON and layer sources before full renders

  The `effing manual` "Inspecting from an agent" section now lays out a
  cheapest-first debugging ladder — read the effie JSON, drill into individual
  layer sources (resolving `#ref`s and fetching signed/CDN source URLs directly),
  and render the full MP4 only for whole-timeline questions like timing,
  transitions, and audio sync. The effie section cross-references it.
  - @effing/effie@0.36.1
  - @effing/fn@0.36.1
  - @effing/serde@0.36.1
  - @effing/annie-player@0.36.1
  - @effing/effie-preview@0.36.1

## 0.36.0

### Patch Changes

- @effing/effie@0.36.0
- @effing/fn@0.36.0
- @effing/serde@0.36.0
- @effing/annie-player@0.36.0
- @effing/effie-preview@0.36.0

## 0.35.3

### Patch Changes

- 02dde82: Inline workspace deps in effing build to avoid ERR_UNKNOWN_FILE_EXTENSION

  `effing build` previously used esbuild's `packages: "external"`, which kept
  every dependency unbundled — including pnpm workspace packages. Workspace
  packages whose `main` points at raw TypeScript (e.g. `"main": "src/index.ts"`)
  then crashed `node dist/server.js` with `ERR_UNKNOWN_FILE_EXTENSION ".ts"`.
  Replaced with an explicit external list (`node:*`, `@napi-rs/canvas`); only
  node built-ins and the native `.node` binding stay external, everything else
  is inlined.

- f48abe6: Reset effie preview render state when switching resolution, and vertically center the download-video button label
  - @effing/effie@0.35.3
  - @effing/fn@0.35.3
  - @effing/serde@0.35.3
  - @effing/annie-player@0.35.3
  - @effing/effie-preview@0.35.3

## 0.35.2

### Patch Changes

- Updated dependencies [9143bdd]
  - @effing/effie@0.35.2
  - @effing/effie-preview@0.35.2
  - @effing/fn@0.35.2
  - @effing/serde@0.35.2
  - @effing/annie-player@0.35.2

## 0.35.1

### Patch Changes

- @effing/effie@0.35.1
- @effing/fn@0.35.1
- @effing/serde@0.35.1
- @effing/annie-player@0.35.1
- @effing/effie-preview@0.35.1

## 0.35.0

### Patch Changes

- a24519c: Default the Effie preview render scale to 100%
- Updated dependencies [4602b17]
  - @effing/annie-player@0.35.0
  - @effing/effie-preview@0.35.0
  - @effing/effie@0.35.0
  - @effing/fn@0.35.0
  - @effing/serde@0.35.0

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
