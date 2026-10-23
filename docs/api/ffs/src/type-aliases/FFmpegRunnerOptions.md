[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunnerOptions

# Type Alias: FFmpegRunnerOptions

> **FFmpegRunnerOptions** = `object`

Defined in: [ffs/src/ffmpeg.ts:422](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L422)

## Properties

### decodeTracks?

> `optional` **decodeTracks?**: `number`

Defined in: [ffs/src/ffmpeg.ts:427](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L427)

The most tracks (FFmpeg decoders) a streamed JPEG annie is split over;
1 not to split. Defaults to a decoder per 4 cores, at most 4.
