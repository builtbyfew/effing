---
"@effing/ffs": minor
---

Render with FFmpeg 9.0.1 (requires FFmpeg 8.0 or newer)

The filter graph now targets FFmpeg 8.0 or newer and the bundled binary is
9.0.1:

- Dropped the `fifo` filter from the global background chain; it was removed
  upstream in FFmpeg 7.0. The chain always goes through `split` now, also
  for a single consumer.
- Delayed layers are padded with `tpad` instead of a concatenated transparent
  colour source. The padding is generated at the layer's own size, so a
  delayed layer smaller than the frame no longer fails the render with a
  concat size mismatch; the stream is re-anchored to the effie's frame rate
  after padding, which keeps FFmpeg >= 8.0 from running away for ~1e6 frames
  on delayed image layers; and it is capped at the segment duration, so a
  delay whose `delay * fps` is not an integer (e.g. 0.25 s at 30 fps) no
  longer yields an extra frame per segment that drifted video from audio.
- Output is pinned to limited colour range (`-color_range tv`) so a JPEG
  (full-range) layer no longer turns the whole output into a full-range video
  on FFmpeg >= 7.1.
- `ffs render` now routes HTTP(S) video/audio inputs through the local proxy
  like the server does, so FFmpeg 9's default TLS verification (which has no
  system CA store in the static build) does not break https sources.
- The HTTP proxy cancels the upstream fetch when FFmpeg drops a response,
  which it does for every byte-range re-request (e.g. after reading an mp4's
  `moov` atom), instead of leaving the upstream connection open.
- A warning is logged once per process when the resolved FFmpeg binary is
  older than 8.0.

Behaviour change: FFmpeg 6.1 dropped the last frame of any video with a
layered segment, so videos are now exactly `fps * duration` frames long (one
frame longer than before). FFmpeg 6.1 still renders with that caveat; FFmpeg
7.x is not supported because its `xfade` rejects the segment chains as
variable frame rate.
