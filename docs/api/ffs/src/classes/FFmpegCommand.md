[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:139](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L139)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:145](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L145)

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

Defined in: [ffs/src/ffmpeg.ts:142](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L142)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:140](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L140)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:141](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L141)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:143](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L143)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:157](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L157)

#### Parameters

##### inputResolver

(`input`) => `FFmpegInputSource`

#### Returns

`string`[]
