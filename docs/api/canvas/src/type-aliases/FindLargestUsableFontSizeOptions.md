[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / FindLargestUsableFontSizeOptions

# Type Alias: FindLargestUsableFontSizeOptions

> **FindLargestUsableFontSizeOptions** = `object`

Defined in: [packages/canvas/src/fit-text.ts:9](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L9)

Options for [findLargestUsableFontSize](../functions/findLargestUsableFontSize.md).

## Properties

### font

> **font**: [`FontData`](FontData.md)

Defined in: [packages/canvas/src/fit-text.ts:13](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L13)

Font data to use for measurement

***

### lineHeight?

> `optional` **lineHeight**: `number` \| `"normal"`

Defined in: [packages/canvas/src/fit-text.ts:19](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L19)

Line height — `"normal"` uses font metrics, numeric values are CSS multipliers

***

### maxFontSize?

> `optional` **maxFontSize**: `number`

Defined in: [packages/canvas/src/fit-text.ts:28](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L28)

Maximum font size to consider (default: 1000)

***

### maxHeight

> **maxHeight**: `number`

Defined in: [packages/canvas/src/fit-text.ts:17](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L17)

Maximum height in pixels

***

### maxWidth

> **maxWidth**: `number`

Defined in: [packages/canvas/src/fit-text.ts:15](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L15)

Maximum width in pixels

***

### minFontSize?

> `optional` **minFontSize**: `number`

Defined in: [packages/canvas/src/fit-text.ts:26](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L26)

Minimum font size to consider (default: 1)

***

### text

> **text**: `string`

Defined in: [packages/canvas/src/fit-text.ts:11](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L11)

The text to fit

***

### whiteSpace?

> `optional` **whiteSpace**: `ComputedStyle`\[`"whiteSpace"`\]

Defined in: [packages/canvas/src/fit-text.ts:24](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L24)

Whitespace handling, mirroring CSS. Use `"nowrap"` (or `"pre"`) to fit text
on a single line instead of wrapping to `maxWidth` (default: `"normal"`).
