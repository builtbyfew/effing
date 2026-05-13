---
"@effing/annie-player": minor
---

Add scrubbing support to the Annie player

Exposes a new `seek()` method and `currentFrame` field on `AnniePlayerCore`,
plus `AnniePlayer.Scrubber` and `AnniePlayer.FrameCounter` compound
components. The simple `<AnniePlayer />` now renders a scrubber and frame
counter overlay at the bottom of the canvas. `play()` resumes from the
current frame instead of restarting at frame 0; only `stop()` resets.
