[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / EffieResponseOptions

# Type Alias: EffieResponseOptions

> **EffieResponseOptions** = `object`

Defined in: [packages/effie/src/response.ts:6](https://github.com/builtbyfew/effing/blob/57e26752bafe0001bb1627bb2259be5df6af5f61/packages/effie/src/response.ts#L6)

Options for effie Response generation

## Properties

### cacheControl?

> `optional` **cacheControl**: `string`

Defined in: [packages/effie/src/response.ts:10](https://github.com/builtbyfew/effing/blob/57e26752bafe0001bb1627bb2259be5df6af5f61/packages/effie/src/response.ts#L10)

Cache-Control header value (default: "public, max-age=3600")

***

### headers?

> `optional` **headers**: `HeadersInit`

Defined in: [packages/effie/src/response.ts:8](https://github.com/builtbyfew/effing/blob/57e26752bafe0001bb1627bb2259be5df6af5f61/packages/effie/src/response.ts#L8)

Additional headers to include in the response
