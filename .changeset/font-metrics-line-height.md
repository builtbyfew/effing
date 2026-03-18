---
"@effing/canvas": patch
---

Use font typographic metrics for `line-height: normal` instead of canvas bounding box

Parse `sTypoAscender`, `sTypoDescender`, and `sTypoLineGap` from the font's OS/2
table at registration time and use them to compute `line-height: normal` per the
CSS spec. This fixes vertical text positioning in flex containers with
`alignItems: "center"` to match Satori's output.
