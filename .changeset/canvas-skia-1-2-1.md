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
  each `FontData`'s `weight` and `style` as its descriptors. A variable font
  (TrueType, OpenType, WOFF or WOFF2) claims its whole weight axis instead,
  so it still draws every weight as its own instance when registered once.
  A static face of the same family registered after it takes its own
  weight over from it; one registered before it is shadowed, so list a
  variable font first in `fonts`.
- One static file registered under two weights (the regular file as both 400
  and 700, say) now draws its own outlines at both, as a browser does with
  such `@font-face` rules, instead of a synthesized bold at 700. Register the
  bold file for 700 to draw a real bold.
- `registerFontFromPath` takes the descriptors as an optional third argument
  (`{ weight, style, stretch }`). Pass the file's own when registering more
  than one face of a family from paths.
- If you register fonts with `GlobalFonts.register` or
  `GlobalFonts.registerFromPath` directly, pass `{ weight, style }` as the
  third argument for the same reason.
