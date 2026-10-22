[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRenderer

# Class: EffieRenderer\<U\>

Defined in: [ffs/src/renderer.ts:149](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L149)

## Type Parameters

### U

`U` *extends* `string` = `EffieWebUrl`

## Constructors

### Constructor

> **new EffieRenderer**\<`U`\>(`effieData`, `options?`): `EffieRenderer`\<`U`\>

Defined in: [ffs/src/renderer.ts:157](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L157)

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

Defined in: [ffs/src/renderer.ts:861](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L861)

#### Returns

`void`

***

### render()

> **render**(`scaleFactor?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/renderer.ts:829](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L829)

Renders the effie data to a video stream.

#### Parameters

##### scaleFactor?

`number` = `1`

Scale factor for output dimensions

#### Returns

`Promise`\<`Readable`\>
