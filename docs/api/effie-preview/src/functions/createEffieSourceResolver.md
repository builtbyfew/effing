[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / createEffieSourceResolver

# Function: createEffieSourceResolver()

> **createEffieSourceResolver**(`sources?`): (`src`) => `string`

Defined in: [packages/effie-preview/src/core.ts:16](https://github.com/builtbyfew/effing/blob/b95b8037f746d8f2d1f3d4bcb2f1a6a9f0ee95ec/packages/effie-preview/src/core.ts#L16)

Create a source resolver function that handles #reference lookups
in effie source fields.

## Parameters

### sources?

`EffieSources`

The sources map from an EffieData object

## Returns

A function that resolves source references to URLs

> (`src`): `string`

### Parameters

#### src

`string`

### Returns

`string`

## Example

```ts
const resolve = createEffieSourceResolver(effieJson.sources);
const url = resolve(layer.source); // Handles both "#ref" and direct URLs
```
