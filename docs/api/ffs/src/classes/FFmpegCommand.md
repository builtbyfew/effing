[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [packages/ffs/src/ffmpeg.ts:46](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L46)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`): `FFmpegCommand`

Defined in: [packages/ffs/src/ffmpeg.ts:52](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L52)

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

Defined in: [packages/ffs/src/ffmpeg.ts:49](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L49)

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:47](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L47)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [packages/ffs/src/ffmpeg.ts:48](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L48)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:50](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L50)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`): `string`[]

Defined in: [packages/ffs/src/ffmpeg.ts:64](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L64)

#### Parameters

##### inputResolver

(`input`) => `string`

#### Returns

`string`[]
