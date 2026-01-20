[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / AnnieResponseOptions

# Type Alias: AnnieResponseOptions

> **AnnieResponseOptions** = [`AnnieStreamOptions`](AnnieStreamOptions.md) & `object`

Defined in: [packages/annie/src/response.ts:7](https://github.com/builtbyfew/effing/blob/8f077567c99a3e89632fcfdc03e0041c112d7a80/packages/annie/src/response.ts#L7)

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
