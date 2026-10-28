[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRenderer

# Class: EffieRenderer\<U\>

Defined in: [ffs/src/renderer.ts:188](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L188)

## Type Parameters

### U

`U` *extends* `string` = `EffieWebUrl`

## Constructors

### Constructor

> **new EffieRenderer**\<`U`\>(`effieData`, `options?`): `EffieRenderer`\<`U`\>

Defined in: [ffs/src/renderer.ts:196](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L196)

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

Defined in: [ffs/src/renderer.ts:1063](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L1063)

Stops every render in progress.

#### Returns

`void`

***

### render()

> **render**(`scaleFactor?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/renderer.ts:1017](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L1017)

Renders the effie data to a video stream.

#### Parameters

##### scaleFactor?

`number` = `1`

Scale factor for output dimensions

#### Returns

`Promise`\<`Readable`\>
