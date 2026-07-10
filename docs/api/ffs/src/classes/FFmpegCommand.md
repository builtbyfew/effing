[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [packages/ffs/src/ffmpeg.ts:45](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L45)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [packages/ffs/src/ffmpeg.ts:51](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L51)

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

Defined in: [packages/ffs/src/ffmpeg.ts:48](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L48)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:46](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L46)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [packages/ffs/src/ffmpeg.ts:47](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L47)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:49](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L49)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:63](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L63)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
