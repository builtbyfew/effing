[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / extractEffieSources

# Function: extractEffieSources()

> **extractEffieSources**\<`U`\>(`effieData`, `options`): `string`[]

Defined in: [packages/effie/src/extract.ts:25](https://github.com/builtbyfew/effing/blob/34b1401f7114ae79a6c474a9b83a7523573dcd8d/packages/effie/src/extract.ts#L25)

Extract all source URLs from an EffieData composition.
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

`string`[]

Array of unique source URLs

## Example

```ts
const sources = extractEffieSources(effieData);
// ["https://cdn.example.com/bg.jpg", "https://api.example.com/annie/hero", ...]
```
