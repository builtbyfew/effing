---
"@effing/canvas": patch
---

Use hhea table metrics for line-height: normal instead of OS/2 sTypo metrics

The previous implementation used OS/2 sTypoAscender/sTypoDescender/sTypoLineGap to compute
`line-height: normal`, which produced taller line heights than Chrome (macOS) and Satori.
Now uses hhea ascender/descender with no line gap, matching their behavior.
