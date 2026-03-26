# @effing/canvas

## 0.25.1

## 0.25.0

### Patch Changes

- 05bb661: Fix boxShadow being clipped by the element's own overflow:hidden

  CSS overflow:hidden clips children, not the element's own box-shadow. The shadow
  is now drawn before the overflow clip is applied, matching browser and satori
  behavior.

## 0.24.8

### Patch Changes

- b095865: Use hhea font metrics for text baseline positioning to match Satori

  Baseline positioning now uses hhea-derived ascent/descent instead of canvas
  `fontBoundingBoxAscent/Descent`. For fonts where these values diverge (e.g.
  fonts with USE_TYPO_METRICS set and differing hhea vs sTypo ascenders), this
  aligns our baseline calculation with Satori's. Also extracts a shared
  `fontMetricsToPx` helper to eliminate duplicated hhea-to-pixel conversion.

## 0.24.7

### Patch Changes

- 57d6130: Handle comma-separated font-family in getFontMetrics

  `getFontMetrics` previously matched against the full CSS `font-family` string
  (e.g. `"CentraNo1, Liberation Sans"`), which never matched cache keys stored
  under individual family names. It now splits on commas and tries each name,
  so hhea metrics are correctly resolved for fonts used with fallback chains.

- ad5684d: Support WOFF font metric parsing in `parseFontMetrics`

  Previously `parseFontMetrics` only handled TrueType/OpenType (`.ttf`/`.otf`)
  table directories, silently returning `null` for WOFF files. This meant
  `line-height: normal` fell back to canvas-measured metrics instead of using the
  hhea ascender/descender values from the font. The function now detects the WOFF
  signature, parses the WOFF table directory, and decompresses tables with zlib
  when needed.

## 0.24.6

### Patch Changes

- f4a9717: Rewrite text shadow rendering to match CSS behavior

  Replaces the canvas shadow API with manual shadow drawing. The old approach had
  two issues: (1) `drawTextShadow` called `fillText` to trigger the shadow, then
  callers called `fillText` again — double-painting text with alpha colors, and
  (2) the canvas shadow API renders shadows at full specified opacity regardless of
  text color alpha, while CSS text-shadow scales shadow opacity by the text's alpha.
  Also fixes textShadow being silently ignored on text with letterSpacing.

- 0f82a09: Use hhea table metrics for line-height: normal instead of OS/2 sTypo metrics

  The previous implementation used OS/2 sTypoAscender/sTypoDescender/sTypoLineGap to compute
  `line-height: normal`, which produced taller line heights than Chrome (macOS) and Satori.
  Now uses hhea ascender/descender with no line gap, matching their behavior.

## 0.24.5

### Patch Changes

- dc3bac7: Match Satori's `<img>` dimension derivation when no dimensions are set

  When an `<img>` has neither width nor height, set `width: "100%"` and use
  `setAspectRatio()` so the image fills its parent container, matching Satori's
  behavior. Previously we fell back to natural pixel dimensions, causing layout
  divergence.

## 0.24.4

### Patch Changes

- 4f1b05b: Fall back to natural image dimensions when no width or height is set

  Images with no explicit dimensions could collapse to 0x0 because
  `setAspectRatio()` alone gives Yoga a ratio but no concrete dimension to derive
  from. Now the natural pixel size is used as the default, matching browser
  `<img>` behavior.

## 0.24.3

### Patch Changes

- 9725c49: Use Yoga `setAspectRatio()` for `<img>` dimension derivation

  Previously, the missing dimension was only derived when the set dimension was a
  numeric pixel value. Percentage-based dimensions (e.g. `width="100%"`) and images
  with no explicit dimensions did not preserve the intrinsic aspect ratio. Using
  Yoga's native `setAspectRatio()` handles all cases uniformly.

## 0.24.2

### Patch Changes

- f1a2bfe: Inherit textShadow to child text nodes

## 0.24.1

### Patch Changes

- f03823c: Fix textShadow regex failing on unitless zero values

## 0.24.0

### Minor Changes

- ea8d380: Add `findLargestUsableFontSize` for fitting text to a bounding box

  Binary searches over integer font sizes using the built-in text layout engine to
  find the largest size that keeps text within the given width and height. Supports
  configurable line height, min/max font size bounds, and reuses the existing
  `FontData` type.

## 0.23.2

### Patch Changes

- bb47741: Ceil text node height to prevent Yoga integer rounding from clipping descenders

  When auto line-height produces a fractional totalHeight (e.g. 15.52), Yoga's
  integer rounding (pointScaleFactor=1) could round it down, clipping glyph
  descenders like "g". Applying Math.ceil to totalHeight inside the auto
  line-height block adds at most 1px, ensuring descenders are never cut off.

- dbe77e2: Remove `@effing/satori` package and update all references to use `@effing/canvas`

  The satori package has been fully replaced by the canvas package's built-in JSX
  rendering. All documentation, code examples, and cross-references now point to
  `@effing/canvas` instead. The comparison test in canvas inlines emoji loading
  rather than importing from the removed satori package.

## 0.23.1

### Patch Changes

- b60e0a7: Use canvas-measured ascent/descent for text baseline positioning instead of sTypo font metrics

## 0.23.0

### Minor Changes

- fc2d4f1: Add WebkitTextStroke support for text stroke effects

  Support `WebkitTextStroke`, `WebkitTextStrokeWidth`, and `WebkitTextStrokeColor`
  CSS properties. The shorthand is expanded into width and color longhands, both
  properties inherit like `color`, and stroke is drawn before fill (paint-order:
  stroke) using `ctx.strokeText()` with round line joins.

### Patch Changes

- e72e963: Collapse leading whitespace after `<br />` per CSS Text 3 §4.1.1

## 0.22.3

### Patch Changes

- 9881cea: Use font typographic metrics for `line-height: normal` instead of canvas bounding box

  Parse `sTypoAscender`, `sTypoDescender`, and `sTypoLineGap` from the font's OS/2
  table at registration time and use them to compute `line-height: normal` per the
  CSS spec. This fixes vertical text positioning in flex containers with
  `alignItems: "center"` to match Satori's output.

## 0.22.2

### Patch Changes

- 87fd979: Use ctx.reset() in offscreen canvas pool to fully reset context state

  Replaces manual setTransform + clearRect with ctx.reset() when reusing pooled
  canvases. This prevents leaking styles, clipping regions, and saved state from
  previous consumers.

- d14d923: Resolve viewport-relative units on SVG width/height and apply opacity on `<g>` and shape elements

  SVG elements with viewport-relative units like `width="25vw"` previously resolved to NaN and rendered nothing. The width/height merging now uses `resolveUnit` to handle vw, vh, vmin, vmax, em, rem, etc.

  The `opacity` property on `<g>` elements was silently ignored. It is now applied via `globalAlpha`, and the same treatment is applied to individual shape elements (`<path>`, `<rect>`, etc.) for consistency.

## 0.22.1

### Patch Changes

- d226951: Handle all CSS color formats in SVG fillOpacity/strokeOpacity
- 5b5183a: Inherit SVG stroke properties from parent `<g>` elements

  Stroke attributes (stroke, strokeWidth, strokeLinecap, strokeLinejoin,
  strokeOpacity) set on `<g>` elements now propagate to child shapes, matching
  SVG spec inheritance behavior. Previously only fill was inherited, causing
  stroke-only children to be invisible.

## 0.22.0

### Minor Changes

- a892d9f: Add SVG filter effects support to canvas renderer

  The canvas renderer now processes SVG `<filter>` definitions and applies filter
  primitives (`feOffset`, `feGaussianBlur`, `feColorMatrix`, `feBlend`) during
  rasterization. Filter pipelines use offscreen canvases and named buffers,
  following the same pattern as mask support. This enables rendering of common
  SVG effects like drop shadows.

### Patch Changes

- 72d575d: Collect SVG definition elements (mask, clipPath, filter, gradients) as direct children of `<svg>`, not only inside `<defs>`
- 97db116: Default text-only flex items to flexShrink 1 to match satori

  Text containers without an explicit flexShrink now shrink to fit their
  available flex space instead of overflowing. Also handle `flex: "none"`
  explicitly in style expansion.

- 7914638: Inset image content area by border width so borders on img elements are visible
- cd317ce: Skip flexGrow on implicit text children when justifyContent is non-default

  When a flex container has `justifyContent: "center"` (or other non-default
  values), the implicit text child no longer gets `flexGrow: 1`, allowing yoga to
  position it correctly instead of stretching it to fill the parent.

- c1ba8cc: Apply fillOpacity and strokeOpacity on SVG child elements
- 968710d: Apply transform attribute on SVG shape elements

## 0.21.1

### Patch Changes

- b2d607f: Support borderRadius on per-side borders

  Individual borders (different widths/colors per side) now draw rounded corner
  arcs instead of straight lines when borderRadius is set. Each corner arc is
  assigned to exactly one side to avoid double-stroking anti-aliasing artifacts.

- a4e0548: Flatten array children instead of wrapping them in implicit div nodes

  When JSX children included arrays (from `.map()`, `Array.from()`, etc.),
  `buildNode` wrapped them in a synthetic `<div>` with its own yoga node, breaking
  flex layout because the parent saw fewer children than expected. Arrays are now
  flattened into the parent's child list, matching React/browser behavior.

## 0.21.0

## 0.20.1

### Patch Changes

- 444bb48: Add SVG `<rect rx>` rounded corners and `<mask>` support

  The canvas renderer now correctly handles `rx`/`ry` attributes on SVG `<rect>`
  elements, rendering rounded corners via `Path2D.roundRect()`. Previously these
  attributes were ignored and all rects rendered with sharp corners. Additionally,
  SVG `<mask>` definitions are now collected and applied via offscreen canvas
  compositing with `destination-in`, matching browser rendering behavior.

## 0.20.0

### Minor Changes

- b97fe30: Add lineClamp support to canvas renderer

  The canvas renderer now supports the `lineClamp` CSS property, which truncates
  text to a maximum number of visible lines and appends an ellipsis. Also fixes an
  off-by-one in `truncateWithEllipsis` that could leave one character of headroom
  unused.

- f0673c1: Add width/height override options to renderReactElement

  Layout dimensions now default to `ctx.canvas.width` / `ctx.canvas.height` but
  can be overridden via optional `width` and `height` fields in
  `RenderReactElementOptions`. This enables the standard HiDPI canvas pattern
  (oversized canvas + `ctx.scale(dpr, dpr)`) without layout happening at the
  physical pixel size.

## 0.19.3

### Patch Changes

- cbd1ff4: Clean up draw system and make comparison tests work offline

  Deduplicate drawNode/drawNodeInner into a single drawNodeCore function, extract
  shared CSS utilities to draw/utils.ts, reuse the existing hasRadius helper, and
  consolidate redundant getBorderRadius wrappers. Comparison tests now fall back to
  local Liberation Sans fonts and skip emoji tests when the network is unavailable.

## 0.19.2

### Patch Changes

- 34b2c1b: Wrap root element in a canvas-sized container node during layout

  The layout tree now always wraps the user's root element in a container node
  sized to the canvas dimensions, matching how Satori handles root layout. This
  fixes `position: absolute` on root elements where `top/left/right/bottom` edges
  were ignored because the root node's width/height were overridden to the full
  canvas size after styles were applied.

## 0.19.1

### Patch Changes

- aeea9e5: Fix percentage unit handling across layout and drawing pipeline

  Percentage strings like `width="100%"` on `<svg>` and `<img>` elements were
  silently dropped during viewBox/aspect-ratio derivation, causing the numeric
  part to be treated as pixels. SVG child shapes with percentage attributes
  (e.g. `<rect width="50%">`) produced NaN via `Number()`. Percentage padding
  and border-width values were also silently stripped by `parseFloat()`.

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
