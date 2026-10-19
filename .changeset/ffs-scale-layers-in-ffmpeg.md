---
"@effing/ffs": minor
---

Scale image and animation layers in FFmpeg instead of sharp (requires FFmpeg 8.1 or newer)

Renders with a scale other than 1 used to downscale every image layer, image background and animation frame with sharp before FFmpeg read it. The layers are now scaled inside the FFmpeg filter graph, and sharp is no longer a dependency, so scaled renders no longer need it installed:

- Scaled JPEG layers and image backgrounds look sharper: sharp re-encoded them at JPEG quality 80, which added visible block artifacts.
- JPEG layers and backgrounds tagged with an EXIF orientation are now rotated in scaled renders too, as they already were at scale 1.
- Animations render faster at reduced scale, since their frames are no longer resized one by one before FFmpeg starts: in benchmarks, a 150-frame 1080p animation rendered at half scale in 0.5 s instead of 2.1 s (PNG frames) and 0.9 s instead of 1.7 s (JPEG frames). Compositions of only static images, which are decoded at full size now, take slightly longer (about 0.2 s for nine 1080p image layers) and more memory.
- Layers keep their sizes (`floor(width * scale)` by `floor(height * scale)` pixels), positions and motion. They are scaled with premultiplied alpha, so transparent edges don't darken, but only when the source has an alpha channel: opaque sources such as JPEGs are scaled directly.

Breaking changes:

- Scaled renders need FFmpeg 8.1 or newer, which added the alpha mode negotiation they use. The bundled FFmpeg is 9.0.1; if you point `FFMPEG` at your own binary, FFmpeg 8.0 still renders at scale 1 but fails scaled renders. The one-time version warning now fires below 8.1.
- `FFmpegRunner.run` no longer takes an `imageTransformer`: its signature is now `run(sourceFetcher, referenceResolver?, urlTransformer?)`. Callers that passed a reference resolver or URL transformer positionally must drop the `imageTransformer` argument.
