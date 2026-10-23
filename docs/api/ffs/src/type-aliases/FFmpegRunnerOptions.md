[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegRunnerOptions

# Type Alias: FFmpegRunnerOptions

> **FFmpegRunnerOptions** = `object`

Defined in: [ffs/src/ffmpeg.ts:309](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L309)

## Properties

### decodeTracks?

> `optional` **decodeTracks?**: `number`

Defined in: [ffs/src/ffmpeg.ts:314](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L314)

The most tracks (FFmpeg decoders) a streamed JPEG annie is split over;
1 not to split. Defaults to a decoder per 4 cores, at most 4.
