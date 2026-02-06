[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [packages/ffs/src/ffmpeg.ts:78](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L78)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [packages/ffs/src/ffmpeg.ts:83](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L83)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [packages/ffs/src/ffmpeg.ts:225](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L225)

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `imageTransformer?`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/ffmpeg.ts:87](https://github.com/builtbyfew/effing/blob/a716c0bc2d46c5344c27a6b5712297f176bdf57a/packages/ffs/src/ffmpeg.ts#L87)

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
