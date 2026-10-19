[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRenderer

# Class: EffieRenderer\<U\>

Defined in: [ffs/src/renderer.ts:47](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L47)

## Type Parameters

### U

`U` *extends* `string` = `EffieWebUrl`

## Constructors

### Constructor

> **new EffieRenderer**\<`U`\>(`effieData`, `options?`): `EffieRenderer`\<`U`\>

Defined in: [ffs/src/renderer.ts:54](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L54)

#### Parameters

##### effieData

`EffieData`\<`EffieSources`\<`U`\>, `U`\>

##### options?

[`EffieRendererOptions`](../type-aliases/EffieRendererOptions.md)

#### Returns

`EffieRenderer`\<`U`\>

## Methods

### close()

> **close**(): `void`

Defined in: [ffs/src/renderer.ts:763](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L763)

#### Returns

`void`

***

### render()

> **render**(`scaleFactor?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/renderer.ts:746](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L746)

Renders the effie data to a video stream.

#### Parameters

##### scaleFactor?

`number` = `1`

Scale factor for output dimensions

#### Returns

`Promise`\<`Readable`\>
