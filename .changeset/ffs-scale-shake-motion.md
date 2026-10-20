---
"@effing/ffs": patch
---

Scale shake motion with the render, so scaled renders look like the full render

A shake's `intensity` is in pixels, but scaled renders (`render(scale)` with a scale other than 1) used it as is, so at scale 0.5 a shaking layer moved twice as far relative to the frame and the layer as in the full-size render. The intensity is now multiplied by the render's scale, so scaled renders with shake motion look like the full render, downscaled. Slide and bounce were already relative to the frame and layer size, and no effect or transition takes a size in pixels. Full-size renders are unchanged.
