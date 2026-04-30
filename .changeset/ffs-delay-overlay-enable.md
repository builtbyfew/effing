---
"@effing/ffs": patch
---

Fix overlay enable window to respect `delay` on layers without explicit `from`

Previously, a delayed layer's overlay was enabled for `[0, segment.duration]` regardless of `delay`, while its content stream was front-padded with `nullsrc` for `delay` seconds. Depending on the negotiated pixel format, this padding could composite as opaque green (or any uninitialized color) over lower layers during `[0, delay]`, especially when the layer's motion parked it on-canvas during that window. The fix defaults the overlay enable window to `[delay, segment.duration]`, matching the existing convention in `processMotion` where `delay` already shifts the motion's effective start. An explicit `from` still overrides.
