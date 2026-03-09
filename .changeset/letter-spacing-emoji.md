---
"@effing/canvas": patch
---

Fix `letterSpacing` being ignored when `emojiStyle` is active (the default). `drawSegmentWithEmoji` now draws text runs character-by-character with spacing and accounts for letter spacing in run positioning via `splitTextIntoRuns`.
