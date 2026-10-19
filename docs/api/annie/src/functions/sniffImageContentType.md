[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / sniffImageContentType

# Function: sniffImageContentType()

> **sniffImageContentType**(`bytes`): [`ImageContentType`](../type-aliases/ImageContentType.md) \| `undefined`

Defined in: [annie/src/sniff.ts:21](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/sniff.ts#L21)

Detect a PNG, JPEG or QOI image from its first bytes.

Only the magic bytes are checked, not whether the rest of the image is
valid. Annie frames and fn images carry no other record of their format,
so this is how effing tells them apart.

## Parameters

### bytes

`Uint8Array`

The image's bytes, or at least the first four of them

## Returns

[`ImageContentType`](../type-aliases/ImageContentType.md) \| `undefined`

The image's content type, or `undefined` for anything else

## Example

```ts
sniffImageContentType(await canvas.encode("qoi")); // "image/qoi"
```
