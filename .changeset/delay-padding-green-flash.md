---
"@effing/ffs": patch
---

Fix green flash and off-by-one when rendering animation layers with `delay`

The delay-padding source was `nullsrc`, which emits uninitialised YUV bytes that decode to opaque #008700 when composited over a layer without alpha (e.g. JPEG-encoded annie frames), and defaults to `rate=25` regardless of the effie's fps — producing a frame-rate boundary at the concat point that pushed the output past the segment duration. Padding is now produced by `color=c=black@0` with an explicit `rate=${fps}` and `format=yuva420p`, so the prefix composites transparently and the timeline stays aligned.
