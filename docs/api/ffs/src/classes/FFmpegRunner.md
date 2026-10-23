[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunner

# Class: FFmpegRunner

Defined in: [ffs/src/ffmpeg.ts:426](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L426)

## Constructors

### Constructor

> **new FFmpegRunner**(`command`, `options?`): `FFmpegRunner`

Defined in: [ffs/src/ffmpeg.ts:434](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L434)

#### Parameters

##### command

[`FFmpegCommand`](FFmpegCommand.md)

##### options?

[`FFmpegRunnerOptions`](../type-aliases/FFmpegRunnerOptions.md) = `{}`

#### Returns

`FFmpegRunner`

## Methods

### close()

> **close**(): `void`

Defined in: [ffs/src/ffmpeg.ts:781](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L781)

Stops FFmpeg, or keeps it from starting. The runner can't run again.

#### Returns

`void`

***

### run()

> **run**(`sourceFetcher`, `referenceResolver?`, `urlTransformer?`): `Promise`\<`Readable`\>

Defined in: [ffs/src/ffmpeg.ts:454](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L454)

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
