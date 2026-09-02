---
"@effing/ffs": patch
---

Reset the sample aspect ratio after cover-scaling a background clip

Cover-scaling a background whose aspect doesn't divide evenly into the frame
(for example a 1920×1080 clip in a 1080×1920 effie, which scales to 3413×1920)
made ffmpeg's `scale` filter compensate with a non-square SAR of 10240:10239,
and `crop` kept it. Any segment using a different source (a colour background,
a 9:16 clip) still had SAR 1:1, so the segment `concat` refused to join them
and the render failed with "Nothing was written into output file". When every
segment shared the same landscape clip the render went through but the MP4 was
tagged with a 1920:3413 display aspect ratio instead of 9:16.

Both background chains (global and per-segment) now end in `setsar=1`, so
landscape clips in portrait effies, and portrait clips in landscape effies,
render with square pixels.
