[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / sniffImageContentType

# Function: sniffImageContentType()

> **sniffImageContentType**(`bytes`): [`ImageContentType`](../type-aliases/ImageContentType.md) \| `undefined`

Defined in: [annie/src/sniff.ts:38](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/sniff.ts#L38)

Detect a PNG, JPEG or QOI image from its first bytes.

Checks the PNG signature (all 8 bytes), the JPEG start-of-image marker
followed by another marker (`FF D8 FF`), or the QOI magic (`qoif`). For
QOI, when the whole 14-byte header is there, its channel count must also
be 3 or 4 and its colorspace 0 or 1. Only these leading bytes are
checked, not whether the rest of the image is valid. Annie frames and fn
images carry no other record of their format, so this is how effing
tells them apart.

## Parameters

### bytes

`Uint8Array`

The image's bytes, or at least the first 8 of them (14 for
  QOI's header checks)

## Returns

[`ImageContentType`](../type-aliases/ImageContentType.md) \| `undefined`

The image's content type, or `undefined` for anything else

## Example

```ts
sniffImageContentType(await canvas.encode("qoi")); // "image/qoi"
```
