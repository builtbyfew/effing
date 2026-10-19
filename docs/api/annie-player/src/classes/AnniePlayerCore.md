[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / AnniePlayerCore

# Class: AnniePlayerCore

Defined in: [annie-player/src/core.ts:115](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L115)

Framework-agnostic Annie animation player.
Handles loading TAR archives of image frames and playing them on a canvas.

## Constructors

### Constructor

> **new AnniePlayerCore**(`options`): `AnniePlayerCore`

Defined in: [annie-player/src/core.ts:146](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L146)

#### Parameters

##### options

[`AnniePlayerOptions`](../type-aliases/AnniePlayerOptions.md)

#### Returns

`AnniePlayerCore`

#### Throws

RangeError if `options.fps` is given and isn't a finite number
  greater than 0

## Methods

### attachCanvas()

> **attachCanvas**(`canvas`): `void`

Defined in: [annie-player/src/core.ts:167](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L167)

Attach a canvas element to render the animation on.

#### Parameters

##### canvas

`HTMLCanvasElement`

#### Returns

`void`

***

### cleanup()

> **cleanup**(): `void`

Defined in: [annie-player/src/core.ts:531](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L531)

Clean up resources (revoke blob URLs, drop decoded QOI pixels).

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [annie-player/src/core.ts:545](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L545)

Destroy the player and clean up all resources, including those of a
load that's still running.

#### Returns

`void`

***

### detachCanvas()

> **detachCanvas**(): `void`

Defined in: [annie-player/src/core.ts:175](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L175)

Detach the canvas and stop playback.

#### Returns

`void`

***

### getState()

> **getState**(): [`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

Defined in: [annie-player/src/core.ts:184](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L184)

Get the current state of the player.

#### Returns

[`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

***

### load()

> **load**(): `Promise`\<`void`\>

Defined in: [annie-player/src/core.ts:251](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L251)

Load the animation from the source URL.

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**\<`K`\>(`event`, `callback`): () => `void`

Defined in: [annie-player/src/core.ts:199](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L199)

Subscribe to player events.

#### Type Parameters

##### K

`K` *extends* keyof [`AnniePlayerEvents`](../type-aliases/AnniePlayerEvents.md)

#### Parameters

##### event

`K`

##### callback

`EventCallback`\<[`AnniePlayerEvents`](../type-aliases/AnniePlayerEvents.md)\[`K`\]\>

#### Returns

() => `void`

***

### pause()

> **pause**(): `void`

Defined in: [annie-player/src/core.ts:388](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L388)

Pause the animation at the current frame.

#### Returns

`void`

***

### play()

> **play**(): `void`

Defined in: [annie-player/src/core.ts:368](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L368)

Start playing the animation from the current frame.

#### Returns

`void`

***

### seek()

> **seek**(`frameIndex`): `void`

Defined in: [annie-player/src/core.ts:421](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L421)

Seek to a specific frame. The frame is drawn immediately. Playback state
is preserved — if playing, playback continues forward from the new frame.

#### Parameters

##### frameIndex

`number`

#### Returns

`void`

***

### setFps()

> **setFps**(`fps`): `void`

Defined in: [annie-player/src/core.ts:159](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L159)

Change the playback frame rate. It applies from the next frame, without
reloading or interrupting playback.

#### Parameters

##### fps

`number`

#### Returns

`void`

#### Throws

RangeError if `fps` isn't a finite number greater than 0

***

### stop()

> **stop**(): `void`

Defined in: [annie-player/src/core.ts:407](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L407)

Stop the animation and reset to the first frame.

#### Returns

`void`
