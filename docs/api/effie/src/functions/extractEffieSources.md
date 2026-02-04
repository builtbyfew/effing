[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / extractEffieSources

# Function: extractEffieSources()

> **extractEffieSources**\<`U`\>(`effieData`, `options`): `string`[]

Defined in: [packages/effie/src/extract.ts:120](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/effie/src/extract.ts#L120)

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
