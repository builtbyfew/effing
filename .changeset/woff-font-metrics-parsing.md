---
"@effing/canvas": patch
---

Support WOFF font metric parsing in `parseFontMetrics`

Previously `parseFontMetrics` only handled TrueType/OpenType (`.ttf`/`.otf`)
table directories, silently returning `null` for WOFF files. This meant
`line-height: normal` fell back to canvas-measured metrics instead of using the
hhea ascender/descender values from the font. The function now detects the WOFF
signature, parses the WOFF table directory, and decompresses tables with zlib
when needed.
