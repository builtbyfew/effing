---
"@effing/canvas": minor
---

Add SVG filter effects support to canvas renderer

The canvas renderer now processes SVG `<filter>` definitions and applies filter
primitives (`feOffset`, `feGaussianBlur`, `feColorMatrix`, `feBlend`) during
rasterization. Filter pipelines use offscreen canvases and named buffers,
following the same pattern as mask support. This enables rendering of common
SVG effects like drop shadows.
