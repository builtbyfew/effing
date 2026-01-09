[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: packages/ffs/src/ffmpeg.ts:70

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: packages/ffs/src/ffmpeg.ts:75

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: packages/ffs/src/ffmpeg.ts:192

#### Returns

`void`

***

### run()

> **run**(`sourceResolver`, `imageTransformer?`): `Promise`\<`Readable`\>

Defined in: packages/ffs/src/ffmpeg.ts:79

#### Parameters

##### sourceResolver

(`input`) => `Promise`\<`Readable`\>

##### imageTransformer?

(`imageStream`) => `Promise`\<`Readable`\>

#### Returns

`Promise`\<`Readable`\>
