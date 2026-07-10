[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / AnnieSource

# Type Alias: AnnieSource

> **AnnieSource** = `Uint8Array` \| `ArrayBuffer` \| `Iterable`\<`Uint8Array`\> \| `AsyncIterable`\<`Uint8Array`\> \| `ReadableStream`\<`Uint8Array`\>

Defined in: [packages/annie/src/read.ts:59](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L59)

Byte source an annie can be read from.

Node `Readable` streams satisfy `AsyncIterable<Uint8Array>`, and Web
`ReadableStream`s are consumed via async iteration where available,
falling back to `getReader()` otherwise.
