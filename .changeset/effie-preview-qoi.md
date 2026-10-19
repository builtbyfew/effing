---
"@effing/effie-preview": minor
---

Show QOI images in previews

The cover, background image and image layer previews use `QoiAwareImg` from `@effing/annie-player`, so a QOI source shows in the browser. Other images render exactly as before, with no extra request. Animation layers play QOI annies through `AnniePlayer`. A video preview's poster is still a plain `poster` attribute, so a QOI cover doesn't show as the poster.
