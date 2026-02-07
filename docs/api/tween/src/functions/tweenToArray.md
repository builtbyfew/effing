[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [tween/src](../README.md) / tweenToArray

# Function: tweenToArray()

> **tweenToArray**\<`T`\>(`count`, `fn`, `options`): `Promise`\<`T`[]\>

Defined in: [packages/tween/src/tween.ts:77](https://github.com/builtbyfew/effing/blob/d1e41c9d99a08f9b11cbccfdd7d9ed3d2ec8f9ae/packages/tween/src/tween.ts#L77)

Tween frames with concurrency control, returning an array

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

`Promise`\<`T`[]\>

Promise resolving to array of resulting frames
