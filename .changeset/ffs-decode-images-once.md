---
"@effing/ffs": patch
---

Decode static images once instead of for every frame

Image layers and image backgrounds were read with `-loop 1`, so FFmpeg decoded the full-size image again for every output frame, and converted or cover-scaled it every time too. Each image is now decoded once, converted (layers) or cover-scaled (backgrounds) once, and repeated inside the filter graph. In benchmarks, compositions with 1080p and 4K images rendered two to three times as fast at full scale, and faster at smaller scales too, while FFmpeg's peak memory roughly halved. Durations, frame counts, timing and effects are unchanged, and so is the rendered video.
