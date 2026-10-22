[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [ffs/src/ffmpeg.ts:157](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L157)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [ffs/src/ffmpeg.ts:163](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L163)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [ffs/src/ffmpeg.ts:325](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L325)

Stops FFmpeg, or keeps it from starting. The runner can't run again.

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/ffmpeg.ts:167](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L167)

#### Parameters

##### sourceFetcher

(`input`) => `Promise`\<`Readable`\>

##### referenceResolver?

(`src`) => `string`

##### urlTransformer?

(`url`) => `string`

#### Returns

`Promise`\<`Readable`\>
