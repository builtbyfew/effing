[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:199](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L199)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`, `filterComplexBuilder?`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:212](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L212)

#### Parameters

##### globalArgs

`string`[]

##### inputs

[`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

##### filterComplex

`string`

##### outputArgs

`string`[]

##### filterComplexBuilder?

`FilterComplexBuilder`

#### Returns

`FFmpegCommand`

## Properties

### filterComplex

> **filterComplex**: `string`

Defined in: [ffs/src/ffmpeg.ts:203](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L203)

The filter graph, for when nothing is known about the sources.

***

### filterComplexBuilder?

> `optional` **filterComplexBuilder?**: `FilterComplexBuilder`

Defined in: [ffs/src/ffmpeg.ts:210](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L210)

Builds the filter graph once the sources are fetched, from what they
turned out to be (e.g. to skip what an opaque layer covers). When
omitted, `filterComplex` is used.

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:200](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L200)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:201](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L201)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:204](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L204)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`, `inputInfo?`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:251](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L251)

#### Parameters

##### inputResolver

(`input`) => `FFmpegInputSource`

##### inputInfo?

`ReadonlyMap`\<`number`, `FFmpegInputInfo`\> = `...`

#### Returns

`string`[]

***

### readInputInfo()

> **readInputInfo**(`localPath`): `Promise`\<`Map`\<`number`, `FFmpegInputInfo`\>\>

Defined in: [ffs/src/ffmpeg.ts:234](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L234)

Reads the FFmpegInputInfo of every image and animation input that has
a local file (see readInputInfo), if the filter graph uses it.

#### Parameters

##### localPath

(`input`) => `string` \| `undefined`

Where an input's source is on disk: the image file,
  or the directory an animation's frames were extracted to (only its
  first frame is read). `undefined` when it isn't on disk.

#### Returns

`Promise`\<`Map`\<`number`, `FFmpegInputInfo`\>\>
