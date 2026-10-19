[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie/src](../README.md) / AnnieFrame

# Type Alias: AnnieFrame

> **AnnieFrame** = `object`

Defined in: [annie/src/read.ts:43](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L43)

A single frame read from an annie.

## Properties

### contentType

> **contentType**: [`AnnieFrameContentType`](AnnieFrameContentType.md)

Defined in: [annie/src/read.ts:49](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L49)

Content type sniffed from the frame's magic bytes

***

### data

> **data**: `Uint8Array`

Defined in: [annie/src/read.ts:51](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L51)

Frame bytes (an independent copy, safe to retain)

***

### index

> **index**: `number`

Defined in: [annie/src/read.ts:45](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L45)

Frame index parsed from the entry name (e.g. 3 for `frame_00003`)

***

### name

> **name**: `string`

Defined in: [annie/src/read.ts:47](https://github.com/builtbyfew/effing/blob/main/packages/annie/src/read.ts#L47)

Original TAR entry name (e.g. `frame_00003`)
