---
"@effing/canvas": minor
---

Update to @effing/skia 1.0.10-effing.8: encode canvases as QOI

`canvas.encode("qoi")` and `canvas.encodeSync("qoi")` encode a canvas as [QOI](https://qoiformat.org), a lossless format with alpha, and `toBuffer`, `toDataURL` and the other MIME-based methods take `"image/qoi"`. `encodeStream` doesn't support it. QOI encodes 8 to 20 times faster than PNG, but its files are up to about twice as large, and many times larger than JPEG for photos. FFS, `@effing/annie` and `@effing/fn` accept QOI images and annie frames.
