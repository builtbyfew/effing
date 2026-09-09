---
"@effing/canvas": patch
---

Require `@napi-rs/canvas` 1.0.9 or later.

Earlier versions cached the typefaces Skia picked for each `ctx.font` (family
list + weight + style) for the lifetime of the process and did not invalidate
that cache when a font was registered
([Brooooooklyn/canvas#1329](https://github.com/Brooooooklyn/canvas/issues/1329)).
Measuring or drawing text for a family or weight before its face was registered
therefore pinned that lookup to the closest face available at the time — the
fallback font, or e.g. the bold face for weight 400 — and later registrations,
including the ones `renderReactElement` does for `options.fonts`, could not fix
it. `@napi-rs/canvas` 1.0.9 invalidates the cache on registration
([Brooooooklyn/canvas#1334](https://github.com/Brooooooklyn/canvas/pull/1334));
the peer range now requires it, and a regression test covers the
registration-order scenarios.
