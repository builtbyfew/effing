[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / qoiToPngBlob

# Function: qoiToPngBlob()

> **qoiToPngBlob**(`bytes`): `Promise`\<`Blob`\>

Defined in: [annie-player/src/qoi-image.ts:13](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/qoi-image.ts#L13)

Convert a QOI image to a PNG `Blob`, which browsers can show, for
example through an object URL in an `<img>`.

Browser-only: the pixels are drawn on an `OffscreenCanvas`, or on a canvas
element where `OffscreenCanvas` has no 2D context.

## Parameters

### bytes

`Uint8Array`

The complete QOI file

## Returns

`Promise`\<`Blob`\>

## Throws

Error if the bytes aren't a valid QOI image
