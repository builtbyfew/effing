[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieResponse

# Function: effieResponse()

> **effieResponse**\<`S`\>(`data`, `options`): `Response`

Defined in: [packages/effie/src/response.ts:32](https://github.com/builtbyfew/effing/blob/b46122bc8e003db755cd7f9a9ac0b2b2179d2bdf/packages/effie/src/response.ts#L32)

Create an HTTP Response containing effie JSON data

This is the most convenient way to serve an effie composition from a web server.
It handles JSON serialization, content-type, and caching headers automatically.

## Type Parameters

### S

`S` *extends* [`EffieSources`](../type-aliases/EffieSources.md)

## Parameters

### data

[`EffieData`](../type-aliases/EffieData.md)\<`S`\>

The effie data to serialize

### options

[`EffieResponseOptions`](../type-aliases/EffieResponseOptions.md) = `{}`

Configuration options

## Returns

`Response`

Response with JSON body

## Example

```ts
// In a route handler:
export async function loader({ params }: LoaderFunctionArgs) {
  const effie = await renderEffie(effieId, props, { width, height });
  return effieResponse(effie);
}
```
