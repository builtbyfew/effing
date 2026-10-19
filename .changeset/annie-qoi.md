---
"@effing/annie": minor
---

Recognise QOI annie frames, and export `sniffImageContentType`

`annieFrames` now reports frames that start with the [QOI](https://qoiformat.org) magic (`qoif`) as `"image/qoi"`, a new member of `AnnieFrameContentType`; they used to come back as `"application/octet-stream"`. An annie's frames may vary in pixel format, channels and size, but must all be one format (PNG, JPEG or QOI): `annieFrames` reads a mix, but FFS can't render one.

The new `sniffImageContentType(bytes)` detects a PNG, JPEG or QOI image from its leading bytes, the way `annieFrames` does, and returns `undefined` for anything else. It checks the full 8-byte PNG signature and `FF D8 FF` for JPEG, where `annieFrames` used to check only the first 2 bytes: a frame that starts with `89 50` or `FF D8` but has no full PNG signature or `FF D8 FF` is now reported as `"application/octet-stream"`. Valid PNG and JPEG images always have them.
