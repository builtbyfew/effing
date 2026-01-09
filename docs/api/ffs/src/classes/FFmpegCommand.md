[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: packages/ffs/src/ffmpeg.ts:26

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: packages/ffs/src/ffmpeg.ts:32

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

Defined in: packages/ffs/src/ffmpeg.ts:29

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: packages/ffs/src/ffmpeg.ts:27

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: packages/ffs/src/ffmpeg.ts:28

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: packages/ffs/src/ffmpeg.ts:30

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: packages/ffs/src/ffmpeg.ts:44

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
