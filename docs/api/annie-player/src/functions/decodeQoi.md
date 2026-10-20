[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / decodeQoi

# Function: decodeQoi()

> **decodeQoi**(`bytes`, `output?`): [`QoiImage`](../type-aliases/QoiImage.md)

Defined in: [annie-player/src/qoi.ts:117](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/qoi.ts#L117)

Decode a QOI image to RGBA pixels.

Both 3- and 4-channel images decode to 4 bytes per pixel; a 3-channel
image's pixels are opaque. The colorspace is reported but not applied.

## Parameters

### bytes

`Uint8Array`

The complete QOI file

### output?

`Uint8ClampedArray`\<`ArrayBufferLike`\>

Optional buffer to decode into, such as a reused
  `ImageData`'s `data`. It must hold exactly `width × height × 4` bytes.
  When omitted, a new buffer is allocated.

## Returns

[`QoiImage`](../type-aliases/QoiImage.md)

## Throws

Error if the data isn't a valid QOI image, is truncated, or
  `output` has the wrong size
