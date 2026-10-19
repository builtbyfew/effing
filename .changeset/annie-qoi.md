---
"@effing/annie": minor
---

Recognise QOI annie frames, and export `sniffImageContentType`

`annieFrames` now reports frames that start with the [QOI](https://qoiformat.org) magic (`qoif`) as `"image/qoi"`, a new member of `AnnieFrameContentType`; they used to come back as `"application/octet-stream"`. An annie may mix PNG, JPEG and QOI frames.

The new `sniffImageContentType(bytes)` detects a PNG, JPEG or QOI image from its magic bytes, the way `annieFrames` does, and returns `undefined` for anything else.
