[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [packages/ffs/src/ffmpeg.ts:70](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L70)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [packages/ffs/src/ffmpeg.ts:75](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L75)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [packages/ffs/src/ffmpeg.ts:212](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L212)

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `imageTransformer?`, `referenceResolver?`): `Promise`\<`Readable`\>

Defined in: [packages/ffs/src/ffmpeg.ts:79](https://github.com/builtbyfew/effing/blob/2c97f5425b37bd52710264fd620a9facd9749d7a/packages/ffs/src/ffmpeg.ts#L79)

#### Parameters

##### sourceFetcher

(`input`) => `Promise`\<`Readable`\>

##### imageTransformer?

(`imageStream`) => `Promise`\<`Readable`\>

##### referenceResolver?

(`src`) => `string`

#### Returns

`Promise`\<`Readable`\>
