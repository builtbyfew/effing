[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / registerFontFromPath

# Function: registerFontFromPath()

> **registerFontFromPath**(`path`, `nameAlias?`, `descriptors?`): `void`

Defined in: [canvas/src/jsx/font.ts:71](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/jsx/font.ts#L71)

Register a font from a file path.

## Parameters

### path

`string`

Path to the font file

### nameAlias?

`string`

Optional font family name override

### descriptors?

`FontFaceDescriptors`

Optional `@font-face` descriptors (`weight`, `style`,
  `stretch`). A family's faces are matched by them; a face registered
  without any counts as a normal one.

## Returns

`void`
