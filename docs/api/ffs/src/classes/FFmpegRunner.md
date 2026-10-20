[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [ffs/src/ffmpeg.ts:157](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L157)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [ffs/src/ffmpeg.ts:162](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L162)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [ffs/src/ffmpeg.ts:319](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L319)

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/ffmpeg.ts:166](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L166)

#### Parameters

##### sourceFetcher

(`input`) => `Promise`\<`Readable`\>

##### referenceResolver?

(`src`) => `string`

##### urlTransformer?

(`url`) => `string`

#### Returns

`Promise`\<`Readable`\>
