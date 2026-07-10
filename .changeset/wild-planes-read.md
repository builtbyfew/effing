---
"@effing/annie": minor
---

Add `annieFrames`, a canonical reader that async-iterates the frames of an Annie. It accepts bytes, (async) iterables of byte chunks (including Node.js `Readable` streams), or Web `ReadableStream`s, yields frames in ascending index order, and sniffs each frame's content type (PNG/JPEG) from its magic bytes. The format contract — frame naming, zero-padding, format detection — now lives in the package that owns the format.
