---
"@effing/satori": minor
---

Add worker pool, serde sub-path, and decomposed rendering functions

- **`@effing/satori/pool`** — new sub-path exporting `createSatoriPool()` for parallelized Satori rendering across worker threads via Tinypool. The pool exposes `renderToPng`, `renderToSvg`, `rasterizeSvgToPng`, and `destroy` methods.
- **`@effing/satori/serde`** — new sub-path with `expandElement`, `serializeElement`, and `deserializeElement` for structured-clone-safe React element serialization (used internally by the pool, available for custom worker setups).
- **`svgFromSatori(template, options)`** — new export that renders JSX to an SVG string (the first half of the existing pipeline).
- **`rasterizeSvg(svg)`** — new export that rasterizes an SVG string to a PNG buffer via Resvg (the second half).
- **`SatoriOptions`** — new unified options type replacing `PngFromSatoriOptions` (which remains as a deprecated alias).
- `pngFromSatori` now composes `svgFromSatori` + `rasterizeSvg` internally (no API change).
- `react` and `tinypool` are optional peer dependencies (only required for `/pool` and `/serde` sub-paths).
