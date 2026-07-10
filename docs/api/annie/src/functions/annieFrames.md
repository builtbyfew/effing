[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / annieFrames

# Function: annieFrames()

> **annieFrames**(`source`): `AsyncGenerator`\<[`AnnieFrame`](../type-aliases/AnnieFrame.md), `void`, `undefined`\>

Defined in: packages/annie/src/read.ts:226

Async-iterate the frames of an annie (a TAR archive of image frames).

Yields only the frame entries (names matching `frame_<digits>`), in
archive order — which the annie writers guarantee to be ascending index
order. Other entries are skipped. The frame's image format is detected
from its magic bytes (the archive does not record it).

Throws if the archive is truncated, has a corrupt header, or contains no
frames at all.

## Parameters

### source

[`AnnieSource`](../type-aliases/AnnieSource.md)

Annie bytes: a `Uint8Array`/`ArrayBuffer`, an (async)
  iterable of byte chunks (e.g. a Node `Readable`), or a Web
  `ReadableStream`

## Returns

`AsyncGenerator`\<[`AnnieFrame`](../type-aliases/AnnieFrame.md), `void`, `undefined`\>

## Example

```ts
for await (const frame of annieFrames(await fs.readFile("animation.annie"))) {
  console.log(frame.index, frame.contentType, frame.data.length);
}
```
