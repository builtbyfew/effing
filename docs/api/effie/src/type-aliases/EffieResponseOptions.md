[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / EffieResponseOptions

# Type Alias: EffieResponseOptions

> **EffieResponseOptions** = `object`

Defined in: [packages/effie/src/response.ts:6](https://github.com/builtbyfew/effing/blob/d4d0b72ff03d40e85501fd9e6ca0b75564cb7252/packages/effie/src/response.ts#L6)

Options for effie Response generation

## Properties

### cacheControl?

> `optional` **cacheControl**: `string`

Defined in: [packages/effie/src/response.ts:10](https://github.com/builtbyfew/effing/blob/d4d0b72ff03d40e85501fd9e6ca0b75564cb7252/packages/effie/src/response.ts#L10)

Cache-Control header value (default: "public, max-age=3600")

***

### headers?

> `optional` **headers**: `HeadersInit`

Defined in: [packages/effie/src/response.ts:8](https://github.com/builtbyfew/effing/blob/d4d0b72ff03d40e85501fd9e6ca0b75564cb7252/packages/effie/src/response.ts#L8)

Additional headers to include in the response
