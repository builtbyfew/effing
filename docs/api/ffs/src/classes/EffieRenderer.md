[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRenderer

# Class: EffieRenderer\<U\>

Defined in: [packages/ffs/src/render.ts:38](https://github.com/builtbyfew/effing/blob/05a2c5442f4285cc434780987079a8e7a256e33e/packages/ffs/src/render.ts#L38)

## Type Parameters

### U

`U` *extends* `string` = `EffieWebUrl`

## Constructors

### Constructor

> **new EffieRenderer**\<`U`\>(`effieData`, `options?`): `EffieRenderer`\<`U`\>

Defined in: [packages/ffs/src/render.ts:45](https://github.com/builtbyfew/effing/blob/05a2c5442f4285cc434780987079a8e7a256e33e/packages/ffs/src/render.ts#L45)

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

Defined in: [packages/ffs/src/render.ts:671](https://github.com/builtbyfew/effing/blob/05a2c5442f4285cc434780987079a8e7a256e33e/packages/ffs/src/render.ts#L671)

#### Returns

`void`

***

### render()

> **render**(`scaleFactor`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/render.ts:654](https://github.com/builtbyfew/effing/blob/05a2c5442f4285cc434780987079a8e7a256e33e/packages/ffs/src/render.ts#L654)

Renders the effie data to a video stream.

#### Parameters

##### scaleFactor

`number` = `1`

Scale factor for output dimensions

#### Returns

`Promise`\<`Readable`\>
