[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / registerFont

# Function: registerFont()

> **registerFont**(`font`): `void`

Defined in: [canvas/src/jsx/font.ts:18](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/jsx/font.ts#L18)

Register a font from a FontData buffer, with its `weight` and `style` as
its `@font-face` descriptors: a family's faces are matched by them. A
variable font (TrueType, OpenType, WOFF or WOFF2) claims its whole weight
axis instead of `weight`, so each weight draws its own instance.
Registration is idempotent: registering the same name, weight and style
again is a no-op.

## Parameters

### font

[`FontData`](../type-aliases/FontData.md)

Font data to register

## Returns

`void`
