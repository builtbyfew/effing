# @effing/canvas

## 0.19.0

### Minor Changes

- f8445d9: Support `text-box-trim` and `text-box-edge` CSS properties

  Add support for trimming half-leading from text line boxes via `textBoxTrim`,
  `textBoxEdge`, and the `textBox` shorthand. Maps CSS text-edge keywords (`cap`,
  `ex`, `alphabetic`, `text`, `ideographic`) to canvas font metrics for precise
  typographic control.

### Patch Changes

- 7564446: Stop `clipRule` from clipping the canvas on regular SVG elements
- 62aaef6: Support per-side border shorthands (`borderLeft`, `borderRight`, `borderTop`, `borderBottom`)
- b71f485: Resolve CSS units in `fontSize` and `letterSpacing` during style resolution

  `fontSize: "4em"`, `"2rem"`, `"24px"` etc. are now resolved to pixel values in
  `resolveStyle`, so downstream consumers always see a number. Introduces
  `ExpandedStyle` to type the pre-resolution stage cleanly, keeping
  `ComputedStyle.fontSize` strictly `number`.

- 0e5c8f0: Add SVG gradient fill and stroke support to canvas renderer

  The canvas renderer now processes `<linearGradient>` and `<radialGradient>`
  definitions from SVG `<defs>`, applying gradient fills and strokes to shape
  elements via `url(#id)` references.

- 6651605: Support SVG `transform` attribute on `<g>` elements in canvas renderer

## 0.18.6

### Patch Changes

- cf3b58a: Fix special character rendering (`€`, `²`, accented letters) by building a font fallback chain from all provided fonts and quoting multi-word family names in the CSS font shorthand passed to `@napi-rs/canvas`.
- c135efa: Generalize CSS unit resolution in `transform` and `transformOrigin` strings. Units like `vw`, `vh`, `em`, `rem`, `px`, `pt`, etc. are now resolved to pixel values at layout time instead of being silently dropped by `parseFloat()` at draw time.
- cd75f46: Support SVG `<clipPath>` definitions in the canvas renderer. `<clipPath>` elements inside `<defs>` were silently skipped, and `clip-path="url(#id)"` attributes on elements were never resolved. The renderer now collects `<clipPath>` definitions in a first pass, builds a combined `Path2D` from their child shapes, and applies `ctx.clip()` before drawing elements that reference them.
- c8779d5: Resolve percentage values in CSS `translate()` transforms against the element's own dimensions. `translate(-50%, -50%)` now correctly shifts by half the element's width/height instead of being interpreted as pixels.

## 0.18.5

### Patch Changes

- 5cb25b8: Fix CSS units being silently stripped in shorthand expansion (`margin`, `padding`, `borderRadius`, `gap`, etc.). `parseValue()` now uses `Number()` instead of `parseFloat()`, preserving unit strings like `"50%"`, `"2em"`, `"10px"` for downstream resolution. Border-radius properties are also added to `DIMENSION_PROPS` so `resolveUnits()` handles `em`/`rem`/`vw`/etc. on them.
- 0198a76: Fix rendering of multiple layered CSS background gradients on React elements (e.g. `backgroundImage: "linear-gradient(...), linear-gradient(...)"`). The full multi-layer string was passed as-is to the gradient parser, whose greedy regex captured across both gradients and produced corrupted color stops. Now `backgroundImage` is split into individual layers using paren-depth-aware comma splitting, and each layer is rendered bottom-to-top per CSS stacking order.
- a187432: Fix `letterSpacing` being ignored when `emojiStyle` is active (the default). `drawSegmentWithEmoji` now draws text runs character-by-character with spacing and accounts for letter spacing in run positioning via `splitTextIntoRuns`.
- 8a29c96: Fix SVG `fillRule="evenodd"` not being applied. Compound paths with holes (e.g. a map pin with a circular cutout) were rendered solid because `ctx.fill()` defaulted to `"nonzero"`. The fill rule and clip rule are now read from element props and forwarded to the Canvas 2D API.

## 0.18.4

### Patch Changes

- eb5c6d1: Fix `<img>` and `<svg>` elements with percentage `width`/`height` HTML attributes (e.g. `<img width="100%" height="100%">`) collapsing to 0×0. Percentage strings are now preserved instead of being coerced through `Number()` which produced `NaN`.
- 1dbc177: Fix `currentColor` in SVG `fill` and `stroke` attributes. The literal string was passed straight through to the canvas 2D API which doesn't understand it. It is now resolved to the inherited CSS `color` value.
- 6c7953a: Fix `textAlign: "center"` (and `"right"`) on divs. The text child yoga node now sets `flexGrow: 1` and `flexShrink: 1` so it fills the parent's width, giving `layoutText` the full container width to calculate alignment offsets against.

## 0.18.3

### Patch Changes

- c5de3aa: Fix `<img>` elements with positional sizing (e.g. `position: absolute` with `top`/`left`/`right`/`bottom`) collapsing when no explicit `width`/`height` is set. Natural dimensions are no longer forced onto the style — only a missing dimension is derived when exactly one is provided.

## 0.18.2

### Patch Changes

- 35c8a2c: Intrinsic auto-sizing for `<img>` elements. When only one of `width`/`height` is specified (or neither), the missing dimension is now derived from the image's natural aspect ratio — matching browser behavior. Images are loaded during layout and cached to avoid a redundant load at draw time.
- a75e320: Support SVG presentation attributes set via the `style` prop (e.g. `style={{ fill: 'blue' }}`). Style values take precedence over direct props, matching browser CSS specificity rules.

## 0.18.1

### Patch Changes

- 8718e68: Support CSS viewport and absolute units (`vw`, `vh`, `vmin`, `vmax`, `em`, `rem`, `px`, `pt`, `pc`, `in`, `cm`, `mm`) in style dimensions, resolving them to pixels during layout.
- 63a015d: Support hyphenated SVG stroke attributes (`stroke-width`, `stroke-linecap`, `stroke-linejoin`) that React preserves as string-keyed props from JSX.
- 7cb4a47: Fix blurry output when using scale transforms by rendering offscreen buffers at quantized resolution (ceil of absolute scale value). The buffer resolution only changes at integer boundaries, eliminating jitter, and the composite is always a downscale, producing sharp output.

## 0.18.0

### Minor Changes

- bb59987: Introduce `@effing/canvas` — server-side canvas with JSX and Lottie support. Provides `renderReactElement()` for JSX-to-canvas rendering with Yoga flex layout, emoji support, and font management, plus `loadLottie()` / `renderLottieFrame()` for Lottie animation frames.

### Patch Changes

- 0bd4786: Fix SVG elements with a `viewBox` but only one of `width`/`height` specified rendering as invisible. The missing dimension is now derived from the viewBox aspect ratio.
