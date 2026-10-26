---
"@effing/canvas": patch
---

Clip inset box shadows to the padding box as the borders draw it: with elliptical corners where the border widths differ (scaled down to fit), and with negative border widths treated as none. The shadow no longer leaves a gap at, or paints over, a border's inner curve (#236).
