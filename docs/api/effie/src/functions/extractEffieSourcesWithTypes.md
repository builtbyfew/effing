[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / extractEffieSourcesWithTypes

# Function: extractEffieSourcesWithTypes()

> **extractEffieSourcesWithTypes**\<`U`\>(`effieData`, `options`): [`EffieSourceWithType`](../type-aliases/EffieSourceWithType.md)[]

Defined in: [packages/effie/src/extract.ts:38](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/effie/src/extract.ts#L38)

Extract all source URLs from an EffieData composition with their types.
Resolves #references and deduplicates results.

## Type Parameters

### U

`U` *extends* `string` = [`EffieWebUrl`](../type-aliases/EffieWebUrl.md)

## Parameters

### effieData

[`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\<`U`\>, `U`\>

The Effie composition

### options

[`ExtractSourcesOptions`](../type-aliases/ExtractSourcesOptions.md) = `{}`

Extraction options

## Returns

[`EffieSourceWithType`](../type-aliases/EffieSourceWithType.md)[]

Array of unique source URLs with their types

## Example

```ts
const sources = extractEffieSourcesWithTypes(effieData);
// [{ url: "https://cdn.example.com/bg.jpg", type: "image" }, ...]
```
