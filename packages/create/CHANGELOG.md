# @effing/create

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
