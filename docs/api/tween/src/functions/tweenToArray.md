[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [tween/src](../README.md) / tweenToArray

# Function: tweenToArray()

> **tweenToArray**\<`T`\>(`count`, `fn`, `options`): `Promise`\<`T`[]\>

Defined in: [packages/tween/src/tween.ts:77](https://github.com/builtbyfew/effing/blob/b46122bc8e003db755cd7f9a9ac0b2b2179d2bdf/packages/tween/src/tween.ts#L77)

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
