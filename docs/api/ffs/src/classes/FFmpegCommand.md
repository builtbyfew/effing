[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:104](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L104)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:110](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L110)

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

Defined in: [ffs/src/ffmpeg.ts:107](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L107)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:105](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L105)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:106](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L106)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:108](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L108)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:122](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L122)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
