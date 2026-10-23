[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunnerOptions

# Type Alias: FFmpegRunnerOptions

> **FFmpegRunnerOptions** = `object`

Defined in: [ffs/src/ffmpeg.ts:418](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L418)

## Properties

### decodeTracks?

> `optional` **decodeTracks?**: `number`

Defined in: [ffs/src/ffmpeg.ts:423](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L423)

The most tracks (FFmpeg decoders) a streamed JPEG annie is split over;
1 not to split. Defaults to a decoder per 4 cores, at most 4.
