[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / FontData

# Type Alias: FontData

> **FontData** = `object`

Defined in: [canvas/src/types.ts:13](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L13)

Font data for text rendering.

## Properties

### data

> **data**: `Buffer` \| `ArrayBuffer`

Defined in: [canvas/src/types.ts:15](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L15)

***

### name

> **name**: `string`

Defined in: [canvas/src/types.ts:14](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L14)

***

### style

> **style**: `"normal"` \| `"italic"`

Defined in: [canvas/src/types.ts:21](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L21)

***

### weight

> **weight**: `100` \| `200` \| `300` \| `400` \| `500` \| `600` \| `700` \| `800` \| `900`

Defined in: [canvas/src/types.ts:20](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L20)

The face's weight. A variable font claims its whole weight axis instead
(falling back to this weight if skia rejects the range).
