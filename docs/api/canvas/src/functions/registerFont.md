[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / registerFont

# Function: registerFont()

> **registerFont**(`font`): `void`

Defined in: [canvas/src/jsx/font.ts:25](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/jsx/font.ts#L25)

Register a font from a FontData buffer, with its `weight` and `style` as
its `@font-face` descriptors: a family's faces are matched by them. A
variable font (TrueType, OpenType, WOFF or WOFF2) claims its whole weight
axis instead of `weight`, so each weight draws its own instance. It falls
back to `weight` if skia rejects the range, or if the axis can't be read
(as for a font collection, a WOFF2 font declaring more than 64 MiB
decompressed, or a file that doesn't parse).
Registration is idempotent: registering the same file under the same name,
weight and style again is a no-op. Another file under them is registered
too, and as the newest face it is the one drawn. Registrations are global
to the process, so give each file its own combination of family name,
weight and style.

## Parameters

### font

[`FontData`](../type-aliases/FontData.md)

Font data to register

## Returns

`void`
