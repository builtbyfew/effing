[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [tween/src](../README.md) / tweenToArray

# Function: tweenToArray()

> **tweenToArray**\<`T`\>(`count`, `fn`, `options`): `Promise`\<`T`[]\>

Defined in: [packages/tween/src/tween.ts:77](https://github.com/builtbyfew/effing/blob/418f4968ccdedf5611da4e8c0424ecc3b2aef880/packages/tween/src/tween.ts#L77)

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
