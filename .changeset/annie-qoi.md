---
"@effing/annie": minor
---

Recognise QOI annie frames, and export `sniffImageContentType`

`annieFrames` now reports frames that start with the [QOI](https://qoiformat.org) magic (`qoif`) as `"image/qoi"`, a new member of `AnnieFrameContentType`; they used to come back as `"application/octet-stream"`. An annie's frames may vary in pixel format, channels and size, but must all be one format (PNG, JPEG or QOI): `annieFrames` reads a mix, but FFS can't render one.

The new `sniffImageContentType(bytes)` detects a PNG, JPEG or QOI image from its magic bytes, the way `annieFrames` does, and returns `undefined` for anything else.
