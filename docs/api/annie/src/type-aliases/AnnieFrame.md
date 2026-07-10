[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / AnnieFrame

# Type Alias: AnnieFrame

> **AnnieFrame** = `object`

Defined in: [packages/annie/src/read.ts:33](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L33)

A single frame read from an annie.

## Properties

### contentType

> **contentType**: [`AnnieFrameContentType`](AnnieFrameContentType.md)

Defined in: [packages/annie/src/read.ts:39](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L39)

Content type sniffed from the frame's magic bytes

***

### data

> **data**: `Uint8Array`

Defined in: [packages/annie/src/read.ts:41](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L41)

Frame bytes (an independent copy, safe to retain)

***

### index

> **index**: `number`

Defined in: [packages/annie/src/read.ts:35](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L35)

Frame index parsed from the entry name (e.g. 3 for `frame_00003`)

***

### name

> **name**: `string`

Defined in: [packages/annie/src/read.ts:37](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L37)

Original TAR entry name (e.g. `frame_00003`)
