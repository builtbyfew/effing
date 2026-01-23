[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / EffieResponseOptions

# Type Alias: EffieResponseOptions

> **EffieResponseOptions** = `object`

Defined in: [packages/effie/src/response.ts:6](https://github.com/builtbyfew/effing/blob/98562296ca02b7d0acd65ca6b1aa409be4531969/packages/effie/src/response.ts#L6)

Options for effie Response generation

## Properties

### cacheControl?

> `optional` **cacheControl**: `string`

Defined in: [packages/effie/src/response.ts:10](https://github.com/builtbyfew/effing/blob/98562296ca02b7d0acd65ca6b1aa409be4531969/packages/effie/src/response.ts#L10)

Cache-Control header value (default: "public, max-age=3600")

***

### headers?

> `optional` **headers**: `HeadersInit`

Defined in: [packages/effie/src/response.ts:8](https://github.com/builtbyfew/effing/blob/98562296ca02b7d0acd65ca6b1aa409be4531969/packages/effie/src/response.ts#L8)

Additional headers to include in the response
