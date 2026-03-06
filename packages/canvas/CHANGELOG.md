# @effing/canvas

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
