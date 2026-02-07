[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [tween/src](../README.md) / tween

# Function: tween()

> **tween**\<`T`\>(`count`, `fn`, `options`): `AsyncGenerator`\<`T`\>

Defined in: [packages/tween/src/tween.ts:21](https://github.com/builtbyfew/effing/blob/57e26752bafe0001bb1627bb2259be5df6af5f61/packages/tween/src/tween.ts#L21)

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

Configuration options

#### concurrency?

`number`

## Returns

`AsyncGenerator`\<`T`\>

## Yields

Resulting frames in order
