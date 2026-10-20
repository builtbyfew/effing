[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / AnnieFrameContentType

# Type Alias: AnnieFrameContentType

> **AnnieFrameContentType** = `"image/png"` \| `"image/jpeg"` \| `"image/qoi"` \| `"application/octet-stream"`

Defined in: [annie/src/read.ts:37](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L37)

Content type of a frame, sniffed from its magic bytes.

Annie frames are expected to be PNG, JPEG or QOI; anything else is
reported as `application/octet-stream` and left for the consumer to
handle.
