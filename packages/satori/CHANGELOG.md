# @effing/satori

## 0.10.3

### Patch Changes

- 6695c2c: Fix crash when expanded element tree is a root-level array

  When `expandElement` returns an array at the root level (e.g. from a top-level Fragment or a function component returning a Fragment), satori crashes with `TypeError: Cannot destructure property 'children' of 'p' as it is undefined` because it expects a single element, not an array.

  Added `ensureSingleElement` which wraps root-level arrays in a `<div style={{display: "contents"}}>` — a layout-transparent wrapper that preserves Fragment semantics. Applied in both the pool (before serialization) and the worker (after deserialization) for defense in depth.

## 0.10.2

### Patch Changes

- 6db28a4: Fix nested-array crash when Fragments have siblings

  `expandElement`'s array branch now uses `flatMap` instead of `map`, so Fragment-expanded arrays are flattened into the parent. Previously, a Fragment with multiple children among siblings produced nested arrays like `[<p>, [<span>, <span>], <p>]`, causing Satori to crash with `TypeError: Cannot destructure property 'children' of 'p' as it is undefined`.

## 0.10.1

### Patch Changes

- b76c5c8: Handle React Fragments in serde

  `expandElement` now unwraps `<>...</>` (React Fragments) to their children, preventing `DataCloneError: Symbol(react.fragment) could not be cloned` when passing Fragment-containing JSX through the worker pool. `serializeElement` also gains a guard for non-string element types, producing a clear error instead of a cryptic structured-clone failure.

## 0.10.0

### Minor Changes

- 13d40d8: Add worker pool, serde sub-path, and decomposed rendering functions
  - **`@effing/satori/pool`** — new sub-path exporting `createSatoriPool()` for parallelized Satori rendering across worker threads via Tinypool. The pool exposes `renderToPng`, `renderToSvg`, `rasterizeSvgToPng`, and `destroy` methods.
  - **`@effing/satori/serde`** — new sub-path with `expandElement`, `serializeElement`, and `deserializeElement` for structured-clone-safe React element serialization (used internally by the pool, available for custom worker setups).
  - **`svgFromSatori(template, options)`** — new export that renders JSX to an SVG string (the first half of the existing pipeline).
  - **`rasterizeSvg(svg)`** — new export that rasterizes an SVG string to a PNG buffer via Resvg (the second half).
  - **`SatoriOptions`** — new unified options type replacing `PngFromSatoriOptions` (which remains as a deprecated alias).
  - `pngFromSatori` now composes `svgFromSatori` + `rasterizeSvg` internally (no API change).
  - `react` and `tinypool` are optional peer dependencies (only required for `/pool` and `/serde` sub-paths).

### Patch Changes

- bccd20c: Upgrade satori from 0.12.2 to 0.19.2

  Pulls in yoga-layout (replaces yoga-wasm-web), emoji-regex-xs (replaces emoji-regex), and css-gradient-parser 0.0.17.

## 0.9.0

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

## 0.6.1

## 0.6.0

## 0.5.0

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

## 0.1.2

## 0.1.1
