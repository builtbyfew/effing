---
"@effing/annie-player": minor
---

Read animations through the canonical `annieFrames` reader from `@effing/annie` instead of a hand-rolled untar, dropping the `@andrewbranch/untar.js` dependency. The archive now streams from the response body rather than being buffered whole, frames are ordered by their actual index (name-based sorting mis-ordered unpadded names), and each frame's Blob carries its sniffed content type. The player now only accepts canonical annies: entries must be named `frame_<digits>`, and malformed or truncated archives are rejected.
