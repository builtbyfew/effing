# @effing/canvas

## 0.18.0

### Minor Changes

- bb59987: Introduce `@effing/canvas` — server-side canvas with JSX and Lottie support. Provides `renderReactElement()` for JSX-to-canvas rendering with Yoga flex layout, emoji support, and font management, plus `loadLottie()` / `renderLottieFrame()` for Lottie animation frames.

### Patch Changes

- 0bd4786: Fix SVG elements with a `viewBox` but only one of `width`/`height` specified rendering as invisible. The missing dimension is now derived from the viewBox aspect ratio.
