---
"@effing/canvas": patch
---

Clip inset box shadows to the padding box the borders are drawn to

An inset box shadow inside rounded borders of unequal widths was clipped to a padding box with circular corners, of the border radius less the wider adjoining border, so it painted over the border's elliptical inner curve. It is now clipped to the same padding box as the borders: elliptical corners, scaled down to fit when a wide border leaves no room, and a negative border width treated as none rather than moving the clip outside the box (#236).
