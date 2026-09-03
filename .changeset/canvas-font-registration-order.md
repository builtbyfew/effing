---
"@effing/canvas": patch
---

Document that every face of a family must be registered before the first
measurement or render, and warn when that rule is broken.

`@napi-rs/canvas` caches the typefaces Skia picks for each `ctx.font` (family
list + weight + style) for the lifetime of the process and does not invalidate
that cache when a font is registered later
([Brooooooklyn/canvas#1329](https://github.com/Brooooooklyn/canvas/issues/1329)).
Measuring or drawing text for a family/weight before its face is registered
therefore pins that lookup to the closest face available at the time — the
fallback font, or e.g. the bold face for weight 400 — and later registrations,
including the ones `renderReactElement` does for `options.fonts`, cannot fix it.

`@effing/canvas` now warns once per family/weight/style when text it lays out
requests a face that isn't registered while the family has others, and when
`registerFont` registers a face whose family/weight/style had already been
looked up through this package. Lookups made directly via `ctx.font` are not
observable and don't trigger the warnings. The README documents the constraint
next to the font registration guidance.
