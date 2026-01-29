[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRenderer

# Class: EffieRenderer\<U\>

Defined in: [packages/ffs/src/render.ts:30](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/render.ts#L30)

## Type Parameters

### U

`U` *extends* `string` = `EffieWebUrl`

## Constructors

### Constructor

> **new EffieRenderer**\<`U`\>(`effieData`, `options?`): `EffieRenderer`\<`U`\>

Defined in: [packages/ffs/src/render.ts:36](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/render.ts#L36)

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

Defined in: [packages/ffs/src/render.ts:654](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/render.ts#L654)

#### Returns

`void`

***

### render()

> **render**(`scaleFactor`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/render.ts:644](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/render.ts#L644)

Renders the effie data to a video stream.

#### Parameters

##### scaleFactor

`number` = `1`

Scale factor for output dimensions

#### Returns

`Promise`\<`Readable`\>
