[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / createEffieSourceResolver

# Function: createEffieSourceResolver()

> **createEffieSourceResolver**(`sources?`): (`src`) => `string`

Defined in: [packages/effie-preview/src/core.ts:16](https://github.com/builtbyfew/effing/blob/34b1401f7114ae79a6c474a9b83a7523573dcd8d/packages/effie-preview/src/core.ts#L16)

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
