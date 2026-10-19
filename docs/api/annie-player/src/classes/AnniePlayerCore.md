[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / AnniePlayerCore

# Class: AnniePlayerCore

Defined in: [annie-player/src/core.ts:107](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L107)

Framework-agnostic Annie animation player.
Handles loading TAR archives of image frames and playing them on a canvas.

## Constructors

### Constructor

> **new AnniePlayerCore**(`options`): `AnniePlayerCore`

Defined in: [annie-player/src/core.ts:138](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L138)

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

Defined in: [annie-player/src/core.ts:159](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L159)

Attach a canvas element to render the animation on.

#### Parameters

##### canvas

`HTMLCanvasElement`

#### Returns

`void`

***

### cleanup()

> **cleanup**(): `void`

Defined in: [annie-player/src/core.ts:523](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L523)

Clean up resources (revoke blob URLs, drop decoded QOI pixels).

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [annie-player/src/core.ts:537](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L537)

Destroy the player and clean up all resources, including those of a
load that's still running.

#### Returns

`void`

***

### detachCanvas()

> **detachCanvas**(): `void`

Defined in: [annie-player/src/core.ts:167](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L167)

Detach the canvas and stop playback.

#### Returns

`void`

***

### getState()

> **getState**(): [`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

Defined in: [annie-player/src/core.ts:176](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L176)

Get the current state of the player.

#### Returns

[`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

***

### load()

> **load**(): `Promise`\<`void`\>

Defined in: [annie-player/src/core.ts:243](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L243)

Load the animation from the source URL.

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**\<`K`\>(`event`, `callback`): () => `void`

Defined in: [annie-player/src/core.ts:191](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L191)

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

Defined in: [annie-player/src/core.ts:380](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L380)

Pause the animation at the current frame.

#### Returns

`void`

***

### play()

> **play**(): `void`

Defined in: [annie-player/src/core.ts:360](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L360)

Start playing the animation from the current frame.

#### Returns

`void`

***

### seek()

> **seek**(`frameIndex`): `void`

Defined in: [annie-player/src/core.ts:413](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L413)

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

Defined in: [annie-player/src/core.ts:151](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L151)

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

Defined in: [annie-player/src/core.ts:399](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L399)

Stop the animation and reset to the first frame.

#### Returns

`void`
