[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / FFmpegCommand

# Class: FFmpegCommand

Defined in: [ffs/src/ffmpeg.ts:228](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L228)

## Constructors

### Constructor

> **new FFmpegCommand**(`globalArgs`, `inputs`, `filterComplex`, `outputArgs`, `filterComplexBuilder?`): `FFmpegCommand`

Defined in: [ffs/src/ffmpeg.ts:241](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L241)

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

Defined in: [ffs/src/ffmpeg.ts:232](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L232)

The filter graph, for when nothing is known about the sources.

***

### filterComplexBuilder?

> `optional` **filterComplexBuilder?**: `FilterComplexBuilder`

Defined in: [ffs/src/ffmpeg.ts:239](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L239)

Builds the filter graph once the sources are fetched, from what they
turned out to be (e.g. to skip what an opaque layer covers). When
omitted, `filterComplex` is used.

***

### globalArgs

> **globalArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:229](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L229)

***

### inputs

> **inputs**: [`FFmpegInput`](../type-aliases/FFmpegInput.md)[]

Defined in: [ffs/src/ffmpeg.ts:230](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L230)

***

### outputArgs

> **outputArgs**: `string`[]

Defined in: [ffs/src/ffmpeg.ts:233](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L233)

## Methods

### buildArgs()

> **buildArgs**(`inputResolver`, `inputInfo?`): `string`[]

Defined in: [ffs/src/ffmpeg.ts:309](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L309)

#### Parameters

##### inputResolver

(`input`) => `FFmpegInputSource`

##### inputInfo?

`ReadonlyMap`\<`number`, `FFmpegInputInfo`\> = `...`

#### Returns

`string`[]

***

### canSplitInput()

> **canSplitInput**(`input`, `graph?`): `boolean`

Defined in: [ffs/src/ffmpeg.ts:299](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L299)

Whether an animation input can be read as a Matroska stream of several
tracks (see FFmpegPipeSource): it has a `-framerate` (which sets the
frames' times), and `graph`, the filter graph FFmpeg gets (see
filterGraph), reads its video once, as `[<index>:v]`. A graph can leave
an input out, e.g. a layer beneath a base layer.

#### Parameters

##### input

[`FFmpegInput`](../type-aliases/FFmpegInput.md)

##### graph?

`string` = `...`

#### Returns

`boolean`

***

### filterGraph()

> **filterGraph**(`inputInfo?`): `string`

Defined in: [ffs/src/ffmpeg.ts:284](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L284)

The filter graph for what the inputs' sources turned out to be (see
FilterComplexBuilder): `filterComplex` when there's no builder.

#### Parameters

##### inputInfo?

`ReadonlyMap`\<`number`, `FFmpegInputInfo`\> = `...`

#### Returns

`string`

***

### readInputInfo()

> **readInputInfo**(`localPath`): `Promise`\<`Map`\<`number`, `FFmpegInputInfo`\>\>

Defined in: [ffs/src/ffmpeg.ts:263](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/ffmpeg.ts#L263)

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
