[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:90](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L90)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:96](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L96)

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

Defined in: [ffs/src/ffmpeg.ts:93](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L93)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:91](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L91)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:92](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L92)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:94](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L94)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:108](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L108)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
