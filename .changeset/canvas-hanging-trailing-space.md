---
"@effing/canvas": patch
---

Fix text wrapping pushing a word to the next line when it fits exactly (or with
less than a space's width to spare). The wrapping check measured each candidate
line including the space after its last word; trailing spaces now hang, as in
CSS and satori, and no longer count toward whether a line fits.
