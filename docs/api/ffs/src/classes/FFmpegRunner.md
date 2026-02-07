[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [packages/ffs/src/ffmpeg.ts:90](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L90)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [packages/ffs/src/ffmpeg.ts:95](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L95)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [packages/ffs/src/ffmpeg.ts:237](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L237)

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `imageTransformer?`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/ffmpeg.ts:99](https://github.com/builtbyfew/effing/blob/a59284f037523b29f88f0c9065447ea4615ffb00/packages/ffs/src/ffmpeg.ts#L99)

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
