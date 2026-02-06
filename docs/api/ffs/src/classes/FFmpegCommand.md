[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [packages/ffs/src/ffmpeg.ts:34](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L34)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [packages/ffs/src/ffmpeg.ts:40](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L40)

#### Parameters

##### globalArgs

`string`[]

##### inputs

[`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

##### filterComplex

`string`

##### outputArgs

`string`[]

#### Returns

`FFmpegCommand`

## Properties

### filterComplex

> **filterComplex**: `string`

Defined in: [packages/ffs/src/ffmpeg.ts:37](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L37)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:35](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L35)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [packages/ffs/src/ffmpeg.ts:36](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L36)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:38](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L38)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:52](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L52)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
