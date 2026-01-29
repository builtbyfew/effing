[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [packages/ffs/src/ffmpeg.ts:26](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L26)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [packages/ffs/src/ffmpeg.ts:32](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L32)

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

Defined in: [packages/ffs/src/ffmpeg.ts:29](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L29)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:27](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L27)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [packages/ffs/src/ffmpeg.ts:28](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L28)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:30](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L30)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:44](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L44)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
