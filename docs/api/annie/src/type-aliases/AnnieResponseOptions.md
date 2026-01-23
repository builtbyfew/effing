[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / AnnieResponseOptions

# Type Alias: AnnieResponseOptions

> **AnnieResponseOptions** = [`AnnieStreamOptions`](AnnieStreamOptions.md) & `object`

Defined in: [packages/annie/src/response.ts:7](https://github.com/builtbyfew/effing/blob/d4d0b72ff03d40e85501fd9e6ca0b75564cb7252/packages/annie/src/response.ts#L7)

Options for annie Response generation

## Type Declaration

### cacheControl?

> `optional` **cacheControl**: `string`

Cache-Control header value (default: "public, max-age=3600")

### filename?

> `optional` **filename**: `string`

Filename for Content-Disposition header (without .tar extension)

### headers?

> `optional` **headers**: `HeadersInit`

Additional headers to include in the response
