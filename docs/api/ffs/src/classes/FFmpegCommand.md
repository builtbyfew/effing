[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:99](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L99)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:105](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L105)

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

Defined in: [ffs/src/ffmpeg.ts:102](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L102)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:100](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L100)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:101](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L101)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:103](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L103)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:117](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L117)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
