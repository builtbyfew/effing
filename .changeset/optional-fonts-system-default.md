---
"@effing/canvas": minor
---

Make fonts optional in renderReactElement

The `fonts` option and the entire `options` parameter are now optional. When no
fonts are provided, text renders using system fonts with a default family of
Helvetica, Arial, sans-serif — chosen so @napi-rs/canvas resolves real font
metrics instead of generic ratios.
