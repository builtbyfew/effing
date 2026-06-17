# @effing/fn

## 0.38.2

### Patch Changes

- @effing/annie@0.38.2
- @effing/effie@0.38.2
- @effing/serde@0.38.2

## 0.38.1

### Patch Changes

- @effing/annie@0.38.1
- @effing/effie@0.38.1
- @effing/serde@0.38.1

## 0.38.0

### Patch Changes

- @effing/annie@0.38.0
- @effing/effie@0.38.0
- @effing/serde@0.38.0

## 0.37.1

### Patch Changes

- @effing/annie@0.37.1
- @effing/effie@0.37.1
- @effing/serde@0.37.1

## 0.37.0

### Patch Changes

- @effing/annie@0.37.0
- @effing/effie@0.37.0
- @effing/serde@0.37.0

## 0.36.2

### Patch Changes

- @effing/annie@0.36.2
- @effing/effie@0.36.2
- @effing/serde@0.36.2

## 0.36.1

### Patch Changes

- @effing/annie@0.36.1
- @effing/effie@0.36.1
- @effing/serde@0.36.1

## 0.36.0

### Patch Changes

- @effing/annie@0.36.0
- @effing/effie@0.36.0
- @effing/serde@0.36.0

## 0.35.3

### Patch Changes

- @effing/annie@0.35.3
- @effing/effie@0.35.3
- @effing/serde@0.35.3

## 0.35.2

### Patch Changes

- Updated dependencies [9143bdd]
  - @effing/effie@0.35.2
  - @effing/annie@0.35.2
  - @effing/serde@0.35.2

## 0.35.1

### Patch Changes

- @effing/annie@0.35.1
- @effing/effie@0.35.1
- @effing/serde@0.35.1

## 0.35.0

### Patch Changes

- @effing/annie@0.35.0
- @effing/effie@0.35.0
- @effing/serde@0.35.0

## 0.34.0

### Minor Changes

- e1e6e5e: Add `@effing/dev` — a CLI (`effing dev`, `effing build`) and Vite-based dev server for Effing projects. Reads a new `effing.config.ts` schema. The starter now contains only fn files, fonts, and config; the dev server owns the preview UI and signed-URL endpoints.

  The preview app uses React Router 7 internally, but its deps (`react-router`, `@react-router/dev`, `@react-router/node`, `isbot`, `react-dom`, `@effing/annie-player`, `@effing/effie-preview`, `tiny-invariant`) are kept off the user's `package.json` — at dev start the server symlink-hoists them from `@effing/dev`'s own tree into the user's `node_modules`, and cleans them up on shutdown. The user's deps stay minimal: just the `@effing/*` packages their fns import plus `react`, `tiny-invariant`, and `zod`.

  `effing build` produces a self-contained Node server at `dist/server.js` that exposes the three signed-segment routes via `@effing/fn/server`'s `createFnHttpListener` — no preview UI, no React Router, no Vite at runtime. Run with `node dist/server.js`.

  Also adds a new `@effing/fn/server` subpath export with shared primitives — `signFnSegment`, `verifyFnSegment`, `validateBounds`, `createUrlBuilder`, `createFlatUrlBuilder`, `pipeWebResponse`, `createFnHttpListener` — usable by both the self-host server and Effing Cloud's fn runner. Signed-segment wire format is `{ id, props, bounds: { width, height } }` (nested bounds).

### Patch Changes

- @effing/annie@0.34.0
- @effing/effie@0.34.0
- @effing/serde@0.34.0

## 0.33.1

### Patch Changes

- @effing/annie@0.33.1

## 0.33.0

### Patch Changes

- @effing/annie@0.33.0

## 0.32.0

### Patch Changes

- @effing/annie@0.32.0

## 0.31.4

### Patch Changes

- @effing/annie@0.31.4

## 0.31.3

### Patch Changes

- @effing/annie@0.31.3

## 0.31.2

### Patch Changes

- @effing/annie@0.31.2

## 0.31.1

### Patch Changes

- @effing/annie@0.31.1

## 0.31.0

### Patch Changes

- @effing/annie@0.31.0

## 0.30.2

### Patch Changes

- @effing/annie@0.30.2

## 0.30.1

### Patch Changes

- @effing/annie@0.30.1

## 0.30.0

### Patch Changes

- @effing/annie@0.30.0

## 0.29.1

### Patch Changes

- Updated dependencies [8825191]
  - @effing/annie@0.29.1

## 0.29.0

### Patch Changes

- @effing/annie@0.29.0

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

- f40d92a: Accept Uint8Array in imageResponse and avoid redundant copy

  The `imageResponse` helper now accepts `Uint8Array` instead of `Buffer`, widening
  compatibility beyond Node.js. The response body is passed as the underlying
  `ArrayBuffer` directly, avoiding the previous `new Uint8Array(buffer)` copy.

- Updated dependencies [9d773d6]
  - @effing/annie@0.28.0
