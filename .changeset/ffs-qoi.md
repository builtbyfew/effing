---
"@effing/ffs": minor
---

Render QOI image layers, image backgrounds and annie frames

FFS renders [QOI](https://qoiformat.org) images (with 3 or 4 channels) as image layers and image backgrounds, and annies with QOI frames, at every scale. It needed no code changes, as FFmpeg's QOI decoder and its probing of FFS's extensionless source files already handled them; integration tests now cover QOI from data URLs and over HTTP, at scale 1 and 0.5, including annies whose frames switch between 3 and 4 channels.
