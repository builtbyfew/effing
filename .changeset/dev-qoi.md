---
"@effing/dev": minor
---

Write QOI images from `effing render`, and advise on frame formats

`effing render image <id>` now names its output `<id>.qoi` when the fn serves a QOI image (`image/qoi`). The agent manual (`effing manual`) lists QOI next to PNG and JPEG, and says when to pick which: QOI for text, shapes and transparency in annies, where it encodes many times faster than PNG at up to about twice the size; JPEG for photo-heavy frames; and PNG or JPEG for anything a browser shows, such as an effie's cover.
