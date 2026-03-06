---
"@effing/canvas": patch
---

Fix blurry output when using scale transforms by rendering offscreen buffers at quantized resolution (ceil of absolute scale value). The buffer resolution only changes at integer boundaries, eliminating jitter, and the composite is always a downscale, producing sharp output.
