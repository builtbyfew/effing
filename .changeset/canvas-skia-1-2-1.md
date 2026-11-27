---
"@effing/canvas": minor
---

Update to @effing/skia 1.2.1-effing.1 and register fonts with their weight and style

`@effing/skia` 1.2.1-effing.1 is on upstream `@napi-rs/canvas` 1.2.1, with
Skia chrome/m158, `@font-face` descriptors for font registration and
`ctx.antialias` among its changes.

Canvas text and paragraphs now choose among a family's registered faces by
their `@font-face` descriptors, as a browser does. A face registered without
descriptors counts as a normal one, so in a family registered one file per
style without them, the file registered last would draw every weight and
style. So:

- `registerFont` (and the `fonts` option of `renderReactElement`) now passes
  each `FontData`'s `weight` and `style` as its descriptors. Nothing changes
  for callers.
- `registerFontFromPath` takes the descriptors as an optional third argument
  (`{ weight, style, stretch }`). Pass the file's own when registering more
  than one face of a family from paths.
- If you register fonts with `GlobalFonts.register` or
  `GlobalFonts.registerFromPath` directly, pass `{ weight, style }` as the
  third argument for the same reason.
