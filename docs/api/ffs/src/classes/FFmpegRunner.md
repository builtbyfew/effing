[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [packages/ffs/src/ffmpeg.ts:70](https://github.com/builtbyfew/effing/blob/418f4968ccdedf5611da4e8c0424ecc3b2aef880/packages/ffs/src/ffmpeg.ts#L70)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [packages/ffs/src/ffmpeg.ts:75](https://github.com/builtbyfew/effing/blob/418f4968ccdedf5611da4e8c0424ecc3b2aef880/packages/ffs/src/ffmpeg.ts#L75)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [packages/ffs/src/ffmpeg.ts:192](https://github.com/builtbyfew/effing/blob/418f4968ccdedf5611da4e8c0424ecc3b2aef880/packages/ffs/src/ffmpeg.ts#L192)

#### Returns

`void`

***

### run()

> **run**(`sourceResolver`, `imageTransformer?`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/ffmpeg.ts:79](https://github.com/builtbyfew/effing/blob/418f4968ccdedf5611da4e8c0424ecc3b2aef880/packages/ffs/src/ffmpeg.ts#L79)

#### Parameters

##### sourceResolver

(`input`) => `Promise`\<`Readable`\>

##### imageTransformer?

(`imageStream`) => `Promise`\<`Readable`\>

#### Returns

`Promise`\<`Readable`\>
