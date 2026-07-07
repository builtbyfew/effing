[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [tween/src](../README.md) / tween

# Function: tween()

> **tween**\<`T`\>(`count`, `fn`, `options`): `AsyncGenerator`\<`T`\>

Defined in: [packages/tween/src/tween.ts:33](https://github.com/builtbyfew/effing/blob/main/packages/tween/src/tween.ts#L33)

Tween frames with concurrency control

## Type Parameters

### T

`T`

## Parameters

### count

`number`

Number of frames to generate

### fn

(`interval`, `index`) => `Promise`\<`T`\>

Function that takes a tween interval and index, returns a promise

### options

Configuration options; `concurrency` defaults to the number
of available cores capped at 8 (concurrency overlaps async work such as
encoding, not the synchronous draw)

#### concurrency?

`number`

## Returns

`AsyncGenerator`\<`T`\>

## Yields

Resulting frames in order
