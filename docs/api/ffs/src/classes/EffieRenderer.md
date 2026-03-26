[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRenderer

# Class: EffieRenderer\<U\>

Defined in: [packages/ffs/src/render.ts:39](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/render.ts#L39)

## Type Parameters

### U

`U` *extends* `string` = `EffieWebUrl`

## Constructors

### Constructor

> **new EffieRenderer**\<`U`\>(`effieData`, `options?`): `EffieRenderer`\<`U`\>

Defined in: [packages/ffs/src/render.ts:46](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/render.ts#L46)

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

Defined in: [packages/ffs/src/render.ts:680](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/render.ts#L680)

#### Returns

`void`

***

### render()

> **render**(`scaleFactor`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/render.ts:663](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/render.ts#L663)

Renders the effie data to a video stream.

#### Parameters

##### scaleFactor

`number` = `1`

Scale factor for output dimensions

#### Returns

`Promise`\<`Readable`\>
