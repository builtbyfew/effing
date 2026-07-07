[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [packages/ffs/src/ffmpeg.ts:90](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L90)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [packages/ffs/src/ffmpeg.ts:95](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L95)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [packages/ffs/src/ffmpeg.ts:274](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L274)

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `imageTransformer?`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/ffmpeg.ts:99](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L99)

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
