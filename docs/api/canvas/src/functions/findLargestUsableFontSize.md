[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / findLargestUsableFontSize

# Function: findLargestUsableFontSize()

> **findLargestUsableFontSize**(`options`): `number`

Defined in: [packages/canvas/src/fit-text.ts:41](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L41)

Find the largest integer font size that keeps text within the given bounds.

Uses binary search over integer font sizes, measuring with layoutText
at each step. Returns `minFontSize` if even the smallest size overflows.

By default text wraps to `maxWidth` and is fit into the `maxWidth` × `maxHeight`
box. Set `whiteSpace: "nowrap"` to fit the text on a single line instead, in
which case `maxWidth` constrains the full line width.

## Parameters

### options

[`FindLargestUsableFontSizeOptions`](../type-aliases/FindLargestUsableFontSizeOptions.md)

## Returns

`number`
