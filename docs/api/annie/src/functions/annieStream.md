[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / annieStream

# Function: annieStream()

> **annieStream**(`frames`, `options`): `ReadableStream`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [packages/annie/src/generate.ts:158](https://github.com/builtbyfew/effing/blob/ba28b98e4b8d1cee14453ddc43bc0c37de0f8355/packages/annie/src/generate.ts#L158)

Create a ReadableStream that produces an annie (TAR archive of frames)

Use this when you need the stream but want to customize the Response yourself.

## Parameters

### frames

`AsyncIterable`\<`Buffer`\<`ArrayBufferLike`\>\>

Async iterator yielding PNG or JPEG frame buffers

### options

[`AnnieStreamOptions`](../type-aliases/AnnieStreamOptions.md) = `{}`

Configuration options

## Returns

`ReadableStream`\<`Buffer`\<`ArrayBufferLike`\>\>

ReadableStream of annie data

## Example

```ts
const frames = renderAnnieFrames(annieId, props, { width, height });
const stream = annieStream(frames, { signal: request.signal });
return new Response(stream, {
  headers: { "Content-Type": "application/x-tar" }
});
```
