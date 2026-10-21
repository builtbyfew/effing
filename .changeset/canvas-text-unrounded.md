---
"@effing/canvas": patch
---

Place text where it's laid out, not on the whole pixel above it

Text was placed on the whole pixel above and left of where its layout put it, so the fraction of a pixel of padding, border or centring above or left of it was dropped, always the same way. In a badge or pill, whose edges are rounded to the nearest pixel, the text sat up to 1px high: with `padding: "0.75px 4px"`, 4.25px above the caps and 6px below. Text is drawn unsnapped, so it's now placed at its fractional position, centred as in Chrome. Text with a fraction of a pixel above or left of it moves down or right by less than 1px.

Animations that move text through its layout, such as a growing `paddingTop`, the height of a box it's centred in, or the width of an element before it, move the text smoothly every frame, where it stood still and then jumped a whole pixel.
