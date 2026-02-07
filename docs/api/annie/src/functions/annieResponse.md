[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / annieResponse

# Function: annieResponse()

> **annieResponse**(`frames`, `options`): `Response`

Defined in: [packages/annie/src/response.ts:38](https://github.com/builtbyfew/effing/blob/d1e41c9d99a08f9b11cbccfdd7d9ed3d2ec8f9ae/packages/annie/src/response.ts#L38)

Create an HTTP Response that streams an annie

This is the most convenient way to serve an annie animation from a web server.
It handles all the streaming, headers, and cleanup automatically.

## Parameters

### frames

`AsyncIterable`\<`Buffer`\<`ArrayBufferLike`\>\>

Async iterator yielding PNG or JPEG frame buffers

### options

[`AnnieResponseOptions`](../type-aliases/AnnieResponseOptions.md) = `{}`

Configuration options

## Returns

`Response`

Response streaming the annie

## Example

```ts
// In a route handler:
export async function loader({ request, params }: LoaderFunctionArgs) {
  const frames = renderAnnieFrames(annieId, props, { width, height });
  return annieResponse(frames, {
    signal: request.signal,
    filename: "my-animation",
  });
}
```
