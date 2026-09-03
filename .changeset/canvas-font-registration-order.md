---
"@effing/canvas": patch
---

Make text layout and drawing immune to font registration order, and warn when
a font is registered too late for direct `ctx.font` lookups.

`@napi-rs/canvas` caches the typefaces Skia picks for each `ctx.font` (family
list + weight + style) for the lifetime of the process and does not invalidate
that cache when a font is registered later. Measuring or drawing text for a
family/weight before every face of that family was registered therefore pinned
that lookup to the closest face available at the time — the fallback font, or
e.g. the bold face for weight 400 — and later registrations, including the ones
`renderReactElement` does for `options.fonts`, could not fix it.

`@effing/canvas` now appends a generation-tagged pseudo family to every font
string it sets, so its own lookups (`renderReactElement`,
`findLargestUsableFontSize`) always see every face registered so far. Direct
`ctx.measureText()`/`fillText()` calls remain subject to the upstream cache:
`registerFont` now warns when it detects that the family/weight/style it just
registered had already been looked up that way, and the README documents the
constraint — register every face of a family before the first measurement.
