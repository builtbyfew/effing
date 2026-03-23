---
"@effing/canvas": patch
---

Rewrite text shadow rendering to match CSS behavior

Replaces the canvas shadow API with manual shadow drawing. The old approach had
two issues: (1) `drawTextShadow` called `fillText` to trigger the shadow, then
callers called `fillText` again — double-painting text with alpha colors, and
(2) the canvas shadow API renders shadows at full specified opacity regardless of
text color alpha, while CSS text-shadow scales shadow opacity by the text's alpha.
Also fixes textShadow being silently ignored on text with letterSpacing.
