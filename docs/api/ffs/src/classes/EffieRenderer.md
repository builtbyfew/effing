[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRenderer

# Class: EffieRenderer\<U\>

Defined in: [ffs/src/renderer.ts:39](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L39)

## Type Parameters

### U

`U` *extends* `string` = `EffieWebUrl`

## Constructors

### Constructor

> **new EffieRenderer**\<`U`\>(`effieData`, `options?`): `EffieRenderer`\<`U`\>

Defined in: [ffs/src/renderer.ts:46](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L46)

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

Defined in: [ffs/src/renderer.ts:736](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L736)

#### Returns

`void`

***

### render()

> **render**(`scaleFactor?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/renderer.ts:719](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L719)

Renders the effie data to a video stream.

#### Parameters

##### scaleFactor?

`number` = `1`

Scale factor for output dimensions

#### Returns

`Promise`\<`Readable`\>
