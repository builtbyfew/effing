[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [ffs/src/ffmpeg.ts:292](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L292)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`): `FFmpegRunner`

Defined in: [ffs/src/ffmpeg.ts:299](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L299)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [ffs/src/ffmpeg.ts:601](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L601)

Stops FFmpeg, or keeps it from starting. The runner can't run again.

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/ffmpeg.ts:315](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L315)

Fetches the sources and starts FFmpeg on them, and resolves with its
output.

FFmpeg starts once every source is ready, except annies: those it reads
through a pipe as their frames come in, so it starts once each annie has
its first frame on disk (see AnnieExtraction). A source that fails
before FFmpeg starts rejects the returned promise; an annie that fails
after that stops FFmpeg and destroys the output with its error. A render
only succeeds once every annie is complete, even one FFmpeg didn't need
every frame of.

#### Parameters

##### sourceFetcher

(`input`) => `Promise`\<`Readable`\>

##### referenceResolver?

(`src`) => `string`

##### urlTransformer?

(`url`) => `string`

#### Returns

`Promise`\<`Readable`\>
