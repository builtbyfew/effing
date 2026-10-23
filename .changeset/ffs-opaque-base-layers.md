---
"@effing/ffs": patch
---

Render an opaque layer that covers the frame for its whole segment (a JPEG photo or a JPEG annie, say) over a colour background as the segment's base, instead of converting it to an alpha format and blending it over the background. FFS reads whether a layer is opaque, and its size, from the fetched image's header (an annie's first frame) before it starts FFmpeg. This saves FFmpeg CPU time and around 0.6–1 GB of memory in renders with full-frame photos. For JPEG layers over a colour background the output is unchanged, byte for byte; an opaque RGB PNG or QOI base layer in a render that also has JPEG layers can differ by a few levels of rounding in its segment.
