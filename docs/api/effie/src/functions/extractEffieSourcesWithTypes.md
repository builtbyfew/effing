[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / extractEffieSourcesWithTypes

# Function: extractEffieSourcesWithTypes()

> **extractEffieSourcesWithTypes**\<`U`\>(`effieData`, `options`): [`EffieSourceWithType`](../type-aliases/EffieSourceWithType.md)[]

Defined in: [packages/effie/src/extract.ts:38](https://github.com/builtbyfew/effing/blob/d1e41c9d99a08f9b11cbccfdd7d9ed3d2ec8f9ae/packages/effie/src/extract.ts#L38)

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
