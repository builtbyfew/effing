[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / annieStream

# Function: annieStream()

> **annieStream**(`frames`, `options`): `ReadableStream`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [packages/annie/src/generate.ts:158](https://github.com/builtbyfew/effing/blob/42532851c09d29544ea83bfca09fe5633b7b7130/packages/annie/src/generate.ts#L158)

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
