---
"@effing/fn": minor
---

Serve QOI images from image fns

`imageResponse` now accepts [QOI](https://qoiformat.org) bytes (`canvas.encode("qoi")`) and serves them as `image/qoi`. It used to throw for them. Like `annieFrames`, it now requires the full 8-byte PNG signature or `FF D8 FF` for JPEG, where it used to check the first 2 bytes; valid PNG and JPEG images always pass. Other formats still throw, with the message `Unsupported image format: expected PNG, JPEG or QOI`.
