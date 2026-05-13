# @effing/create

## 0.35.1

### Patch Changes

- c79adcb: Bump starter `effing-cloud` dependency to `^0.5.0` so it picks up support for `effing.config.ts` (the old `effing-cloud.config.ts` name is no longer used)

## 0.35.0

### Patch Changes

- 9cccb2f: Update starter README description to no longer claim it is a React Router app

## 0.34.0

### Minor Changes

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

- c420f00: Preserve image aspect ratio in starter photo-zoom annie

## 0.33.1

### Patch Changes

- 405aa93: Nudge starter projects toward small, single-purpose annies

## 0.33.0

## 0.32.0

### Minor Changes

- 0c4e0f5: Add resolution picker to annie and image preview pages

  The annie and image preview pages now show the same resolution selector as the
  effie preview, driven by the shared `app/resolutions.ts` list, so all three
  preview kinds let you switch between configured aspect ratios with a click.

- cd4f4b5: Make preview resolutions configurable via `app/resolutions.ts`

  The starter now reads its preview resolution selector and the default bounds
  for `parseBoundsFromUrl` from a single `app/resolutions.ts` module, so users
  can adjust the considered aspect ratios in one place instead of editing the
  effie preview route and the URL parser separately.

- 4c68689: Add agent-friendly preview routes for images and annies (`/preview/image/:imageId.bytes`, `/preview/annie/:annieId.tar`) that stream the preview-rendered output directly, mirroring the existing `/preview/effie/:effieId.json` endpoint

### Patch Changes

- 6baa5a8: Drop "Starter" branding from the landing page and meta title

  The meta title is now "Effing" and the landing page heading is "Effing
  Overview", so scaffolded projects don't inherit the starter's branding by
  default and the page describes what it actually is — an index of every fn.

- 6088f5d: Bind starter Vite dev server to 127.0.0.1

## 0.31.4

### Patch Changes

- 55be25e: Document multi-layer composition in the starter GUIDE.md effie section

## 0.31.3

### Patch Changes

- 9771658: Split starter reference docs into a separate `GUIDE.md`

  Scaffolded projects now ship a slim `README.md` (title and a one-line pointer) alongside a self-contained `GUIDE.md` covering setup, project structure, writing fns, fonts, env vars, scripts, and deployment. `AGENTS.md` points agents at `GUIDE.md` so user edits to the README can't accidentally strip the content agents and new contributors rely on. The post-scaffold CLI message now points to `GUIDE.md` rather than listing inline steps, so the `.env` setup step is no longer missed.

## 0.31.2

### Patch Changes

- 82b7bd3: Improve scaffolded README and ship AGENTS.md/CLAUDE.md

  The starter README has been rewritten to read as a project README rather than a demo writeup — it covers the fn module contract, fonts, the JSON inspection workflow, deploying, and points at the per-package READMEs in node_modules for deeper detail. Scaffolded projects also now ship with an AGENTS.md (short orientation for coding agents) and a CLAUDE.md that imports it. The README's H1 is substituted with the project slug at scaffold time.

## 0.31.1

### Patch Changes

- f2be1fa: Add .gitignore to scaffolded starter template

## 0.31.0

### Minor Changes

- aaaa1d7: Add JSON endpoint for effie previews

  Exposes the rendered preview JSON for an effie at `/preview/effie/:effieId.json`
  so that agents can fetch effies (and follow the signed annie/image URLs they
  contain) without scraping the HTML preview page or signing their own URL
  segments. Also factors a shared `parseBounds` helper used by all preview routes,
  which validates the `?w` and `?h` query params (replacing an unvalidated
  `parseInt` that could pass NaN through to the runner).

### Patch Changes

- 3612cdb: Silence Chrome DevTools well-known probe in starter dev server
- 36f979e: Rename starter `fonts.server.ts` to `fonts.ts`

  The file has no server-only secrets or APIs, and `.fn.tsx` files (which import
  it) already lack a `.server` suffix despite running server-only — so the marker
  was inconsistent and added complexity without earning its keep.

- 6186c22: Link to the unsigned JSON preview route from the starter's "JSON →" link
- ee4e8c9: Disable caching for annie, image, and effie responses in the starter when not running in production

## 0.30.2

## 0.30.1

## 0.30.0

### Minor Changes

- 2d72d84: Add effing-cloud scripts to starter template

  Adds `cloud:deploy` and `cloud:url-secret` scripts wired to the `effing-cloud`
  CLI, along with an `effing-cloud.config.ts`.

### Patch Changes

- 1315cbc: Slugify project name and apply to effing-cloud config

  The scaffolder now slugifies the directory basename (lowercase, non-alphanumeric
  characters collapsed to hyphens) and writes it to both `package.json#name` and
  `effing-cloud.config.ts#project`. Previously the cloud config kept its template
  default of `"starter"`, which would collide for every scaffolded project.

- 7d10310: Bump effing-cloud to ^0.4.0 in starter template
- b28fcd6: Allow `@effing/ffmpeg` install script to run under pnpm

  Adds `pnpm.onlyBuiltDependencies` to the scaffolded project's `package.json`
  so pnpm 9+/10 runs the `@effing/ffmpeg` postinstall that downloads the
  ffmpeg binary. Without this, scaffolded projects using pnpm would silently
  skip the binary download and `ffs` would have no ffmpeg to invoke.

- c522951: Update starter README to match the current fn runtime

  The starter's README still described the old `*.annie.tsx`/`*.effie.tsx`
  modules with `AnnieRendererArgs`/`EffieRendererArgs` and an `annieUrl`
  helper. It now documents the unified `*.fn.tsx` modules with a `runner`
  typed via `RunnerArgs` from `@effing/fn`, including a Creating Images
  section and a rewritten URL Generation section around `fnUrl`.

- d69bf35: Move image/annie/effie dimensions into the signed URL segment

  Width and height were previously read from `?w=` and `?h=` query parameters,
  so anyone holding a valid signed segment could request arbitrary dimensions
  (e.g. 100000x100000) and exhaust server resources. The starter now bakes
  width/height into the signed payload alongside `id` and `props` and rejects
  any segment whose bounds aren't positive integers ≤ 8192. Previously-issued
  URLs with `?w=&h=` query strings will no longer resolve — callers need to
  rebuild them via `fnUrl()`.

- 8bf3100: Add `@types/node` to starter devDependencies

  The starter's `tsconfig.json` declares `"types": ["node", "vite/client"]`,
  but `@types/node` was not listed in the package's devDependencies. Inside
  this monorepo it resolved via workspace hoisting, but projects scaffolded
  from the template via `pnpm create @effing` failed to typecheck with
  missing-node-types errors.

## 0.29.1

## 0.29.0

### Minor Changes

- c7f6f10: Use clearer URL segments in starter demo routes

  The scaffolded starter now routes annies/effies/images at `/annie/:segment`,
  `/effie/:segment`, `/image/:segment` with preview pages under
  `/preview/annie/:id`, `/preview/effie/:id`, `/preview/image/:id`, replacing the
  cryptic two-letter segments (`an`, `ff`, `im`, `pan`, `pff`, `pim`). The
  `kindPrefix` indirection in `fn.server.ts` is gone since the URL segment now
  equals the `FnKind`.

- 01e4e6a: Switch demo URL segments to `{ id, props }` shape and make serde key conversion recursive

  The demos/starter URL segments now serialize as `{ id, props }` instead of
  spreading props at the top level alongside a kind-specific id key
  (`{ imageId | annieId | effieId, ...props }`). This gives a uniform contract
  for all three kinds and a clean separation between the module identifier and
  its props.

  To preserve Python `snake_case` → `camelCase` interop for prop names now
  nested one level deeper under `props`, `@effing/serde`'s
  `convertKeysToCamel` conversion in `deserialize` is now recursive across
  plain objects and arrays; primitives and non-plain objects (Date, Buffer,
  class instances) still pass through unchanged.

## 0.28.0

### Minor Changes

- 9d773d6: Move response helpers to @effing/fn and restructure starter template using @effing/fn

  `annieResponse` and `AnnieResponseOptions` have moved from `@effing/annie` to `@effing/fn`.
  `effieResponse` and `EffieResponseOptions` have moved from `@effing/effie` to `@effing/fn`.
  A new `imageResponse` helper is available in `@effing/fn` for serving single images.

  The starter template now uses `@effing/fn` for pluggable module loading (`fnModule`),
  URL building (`fnUrl`), and response helpers. Modules use `.fn.tsx` extension and export
  `runner` instead of `renderer`. A new "image" function kind is supported alongside
  annies and effies.

### Patch Changes

- 2b2adb7: Disable HTTP redirect following in ffsFetch for SSRF protection

  Redirects can bypass SSRF validation by first targeting an allowed URL that
  redirects to an internal IP. ffsFetch now uses `redirect: "manual"` and rejects
  any 3xx response with a descriptive error. Demo preview URLs updated from
  picsum.photos (which relies on redirects) to direct static.effing.dev URLs.

## 0.27.0

## 0.26.1

### Patch Changes

- 64c9b1f: Change license from O'Saasy to MIT

## 0.26.0

## 0.25.1

## 0.25.0

## 0.24.8

## 0.24.7

## 0.24.6

## 0.24.5

## 0.24.4

## 0.24.3

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.2

### Patch Changes

- 266681c: Replace sharp with @effing/canvas in photo-zoom annie
- dbe77e2: Remove `@effing/satori` package and update all references to use `@effing/canvas`

  The satori package has been fully replaced by the canvas package's built-in JSX
  rendering. All documentation, code examples, and cross-references now point to
  `@effing/canvas` instead. The comparison test in canvas inlines emoji loading
  rather than importing from the removed satori package.

## 0.23.1

## 0.23.0

## 0.22.3

## 0.22.2

## 0.22.1

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.1

## 0.20.0

## 0.19.3

## 0.19.2

## 0.19.1

## 0.19.0

## 0.18.6

## 0.18.5

## 0.18.4

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

### Patch Changes

- b53e9ad: Disable caching on the Annie preview route so the player always fetches fresh frames during development.

## 0.17.1

## 0.17.0

## 0.16.0

## 0.15.1

### Patch Changes

- ea08f55: Move `satori` from a direct dependency to a peer dependency of `@effing/satori`, giving consumers control over the installed version. The starter template now lists `satori` as an explicit dependency.
- 31f1900: Bundle satori worker for production: add `vite.config.satori.ts` build step and use pre-built worker file in `pool.server.ts`.

## 0.15.0

### Minor Changes

- 639a093: Add Dockerfile and .dockerignore to starter template for container deployment
- adf62db: Add video download button to the effie preview page. After a render finishes buffering, a "Download video" link appears that saves the MP4 via a blob URL. The download URL is managed inside the render reducer (`downloadUrl` on `ready`/`done` variants, cleared automatically on re-render) with a ref for `revokeObjectURL` cleanup.
- bf082a6: Remove `satoriPoolPlugin` Vite plugin in favor of resolving the worker file from `node_modules` at runtime via `import.meta.resolve`, falling back to relative URL resolution in Vite dev

### Patch Changes

- b35600d: Show elapsed time ticker during render progress in effie preview page

## 0.14.1

## 0.14.0

### Patch Changes

- a776e90: Clean up pff preview route code
  - Replace action result type guards with `intent`/`success` discriminated union
  - Refactor render state tracking from `useState` to `useReducer`
  - Rename variables for clarity
  - Reorder form controls

## 0.13.1

## 0.13.0

## 0.12.0

## 0.11.2

## 0.11.1

## 0.11.0

## 0.10.5

## 0.10.4

## 0.10.3

## 0.10.2

## 0.10.1

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

### Patch Changes

- dedccc7: Fix service worker cache pruning in the starter template: track insertion order explicitly instead of relying on unspecified `cache.keys()` ordering, and run pruning in the background via `event.waitUntil` to avoid blocking the response.

## 0.6.1

### Patch Changes

- cab03d7: Add a service worker to the starter demo that caches FFS render responses, preventing re-fetch failures when the browser revisits one-time-consumption render URLs. Also add `crossOrigin="anonymous"` to the `EffieCoverPreview` video element.

## 0.6.0

## 0.5.0

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

## 0.1.2

### Patch Changes

- b95b803: Use `_DOT_` prefix for dotfiles to preserve underscore-prefixed files

  Previously, the runtime logic converted all underscore-prefixed files to dotfiles, which broke legitimate files like `_index.tsx` (React Router file-system routing convention). Now uses `_DOT_` prefix to distinguish renamed dotfiles from actual underscore-prefixed files.

## 0.1.1

### Patch Changes

- 9856229: Fix catalog: references not being resolved in generated package.json. The copy-template script now parses pnpm-workspace.yaml to resolve all catalog references (like zod) instead of only handling typescript. Also removes the license field from generated projects.
