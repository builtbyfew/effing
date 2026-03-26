[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / findLargestUsableFontSize

# Function: findLargestUsableFontSize()

> **findLargestUsableFontSize**(`options`): `number`

Defined in: [packages/canvas/src/fit-text.ts:32](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/fit-text.ts#L32)

Find the largest integer font size that keeps text within the given bounds.

Uses binary search over integer font sizes, measuring with layoutText
at each step. Returns `minFontSize` if even the smallest size overflows.

## Parameters

### options

[`FindLargestUsableFontSizeOptions`](../type-aliases/FindLargestUsableFontSizeOptions.md)

## Returns

`number`
