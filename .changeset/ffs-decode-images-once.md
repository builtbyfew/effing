---
"@effing/ffs": patch
---

Decode static images once instead of for every frame

Image layers and image backgrounds were read with `-loop 1`, so FFmpeg decoded the full-size image again for every output frame, and converted or cover-scaled it every time too. Each image is now decoded once, converted (layers) or cover-scaled (backgrounds) once, and repeated inside the filter graph. In benchmarks, compositions with 1080p and 4K images rendered two to three times as fast at full scale, and faster at smaller scales too, while FFmpeg's peak memory roughly halved. Durations, frame counts, timing and effects are unchanged, and so is the rendered video.

A corrupt or truncated PNG now fails the render right away. Before, FFmpeg could keep re-reading it and the render never finished.

Annies whose frames change pixel format partway (rgb24 and rgba PNGs mixed, say) or size now render with the right timing and frame count. Before, the change restarted FFmpeg's filter graph: the annie's later frames showed up early and the segment came out a frame or two too long. A frame of a different size is now resized to the size of the annie's first frame, without keeping its aspect ratio.
