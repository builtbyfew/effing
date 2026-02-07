[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieResponse

# Function: effieResponse()

> **effieResponse**\<`S`\>(`data`, `options`): `Response`

Defined in: [packages/effie/src/response.ts:32](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/effie/src/response.ts#L32)

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
