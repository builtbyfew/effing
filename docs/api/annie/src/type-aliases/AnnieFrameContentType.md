[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / AnnieFrameContentType

# Type Alias: AnnieFrameContentType

> **AnnieFrameContentType** = `"image/png"` \| `"image/jpeg"` \| `"application/octet-stream"`

Defined in: packages/annie/src/read.ts:25

Content type of a frame, sniffed from its magic bytes.

Annie frames are expected to be PNG or JPEG; anything else is reported
as `application/octet-stream` and left for the consumer to handle.
