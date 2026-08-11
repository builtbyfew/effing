---
"@effing/canvas": patch
---

Cap the @napi-rs/canvas peer range at the current major

The peer range is now `^1.0.0` instead of `>=1.0.0`, so a future @napi-rs/canvas
2.x is no longer accepted sight-unseen. Since @effing/canvas re-exports
@napi-rs/canvas primitives and surfaces its types (SKRSContext2D, Image,
LottieAnimation), an untested major could break consumers at runtime without any
install-time warning; the range will be widened once a new major is verified.
