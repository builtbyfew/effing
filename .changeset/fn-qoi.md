---
"@effing/fn": minor
---

Serve QOI images from image fns

`imageResponse` now accepts [QOI](https://qoiformat.org) bytes (`canvas.encode("qoi")`) and serves them as `image/qoi`. It used to throw for them. Other formats still throw, with the message `Unsupported image format: expected PNG, JPEG or QOI`.
