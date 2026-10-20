[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:113](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L113)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:119](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L119)

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

Defined in: [ffs/src/ffmpeg.ts:116](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L116)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:114](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L114)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:115](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L115)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:117](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L117)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:131](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L131)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
