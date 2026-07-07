---
"@effing/effie": patch
"@effing/ffs": patch
---

Validate background colors instead of accepting arbitrary strings

The `color` background's `color` field previously accepted any string, and
the FFS renderer interpolated it directly into an ffmpeg lavfi filtergraph
(`color=<value>:size=...`), so a crafted value could smuggle extra lavfi
filters into the render. The Effie schema now constrains `color` to the
forms ffmpeg's `color` source accepts — named colors, `#RRGGBB[AA]`, and
`0xRRGGBB[AA]`, each with an optional `@alpha` suffix — and the FFS renderer
independently rejects colors containing filtergraph metacharacters, which
also covers renders that skip schema validation (`FFS_SKIP_VALIDATION`).
