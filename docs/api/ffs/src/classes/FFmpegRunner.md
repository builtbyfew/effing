[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [ffs/src/ffmpeg.ts:257](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L257)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [ffs/src/ffmpeg.ts:263](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L263)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [ffs/src/ffmpeg.ts:429](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L429)

Stops FFmpeg, or keeps it from starting. The runner can't run again.

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/ffmpeg.ts:267](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L267)

#### Parameters

##### sourceFetcher

(`input`) => `Promise`\<`Readable`\>

##### referenceResolver?

(`src`) => `string`

##### urlTransformer?

(`url`) => `string`

#### Returns

`Promise`\<`Readable`\>
