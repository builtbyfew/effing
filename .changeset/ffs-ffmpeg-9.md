---
"@effing/ffs": minor
---

Render with FFmpeg 9.0.1 (requires FFmpeg >= 8.0, or 6.1 via `FFMPEG`)

The filter graph is now compatible with FFmpeg 7.0+ and the bundled binary is
9.0.1:

- Dropped the `fifo` filter from the global background chain; it was removed
  upstream in FFmpeg 7.0.
- The delay-padding chain is normalised with `fps=` after `concat`, which
  keeps FFmpeg >= 8.0 from running away for ~1e6 frames on delayed image
  layers.
- Output is pinned to limited colour range (`-color_range tv`) so a JPEG
  (full-range) layer no longer turns the whole output into a full-range video
  on FFmpeg >= 7.1.
- `ffs render` now routes HTTP(S) video/audio inputs through the local proxy
  like the server does, so FFmpeg 9's default TLS verification (which has no
  system CA store in the static build) does not break https sources.

Behaviour change: FFmpeg 6.1 dropped the last frame of any video with a
layered segment, so videos are now exactly `fps * duration` frames long (one
frame longer than before). FFmpeg 7.1.x is not supported: its `xfade` rejects
the segment chains as variable frame rate.
