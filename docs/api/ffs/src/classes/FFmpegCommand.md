[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [packages/ffs/src/ffmpeg.ts:61](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L61)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [packages/ffs/src/ffmpeg.ts:67](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L67)

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

Defined in: [packages/ffs/src/ffmpeg.ts:64](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L64)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:62](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L62)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [packages/ffs/src/ffmpeg.ts:63](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L63)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:65](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L65)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:79](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L79)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
