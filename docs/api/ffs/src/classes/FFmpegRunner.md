[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [packages/ffs/src/ffmpeg.ts:105](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L105)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [packages/ffs/src/ffmpeg.ts:110](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L110)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [packages/ffs/src/ffmpeg.ts:275](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L275)

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `imageTransformer?`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/ffmpeg.ts:114](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L114)

#### Parameters

##### sourceFetcher

(`input`) => `Promise`\<`Readable`\>

##### imageTransformer?

(`imageStream`) => `Promise`\<`Readable`\>

##### referenceResolver?

(`src`) => `string`

##### urlTransformer?

(`url`) => `string`

#### Returns

`Promise`\<`Readable`\>
