[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:168](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L168)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:174](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L174)

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

Defined in: [ffs/src/ffmpeg.ts:171](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L171)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:169](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L169)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:170](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L170)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:172](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L172)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:202](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L202)

#### Parameters

##### inputResolver

(`input`) => `FFmpegInputSource`

#### Returns

`string`[]

***

### canSplitInput()

> **canSplitInput**(`input`): `boolean`

Defined in: [ffs/src/ffmpeg.ts:192](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L192)

Whether an animation input can be read as a Matroska stream of several
tracks (see FFmpegPipeSource): it has a `-framerate` (which sets the
frames' times), and the filter graph reads its video once, as
`[<index>:v]`.

#### Parameters

##### input

[`FFmpegInput`](../type-aliases/FFmpegInput.md)

#### Returns

`boolean`
