[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / AnniePlayerCore

# Class: AnniePlayerCore

Defined in: [annie-player/src/core.ts:92](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L92)

Framework-agnostic Annie animation player.
Handles loading TAR archives of image frames and playing them on a canvas.

## Constructors

### Constructor

> **new AnniePlayerCore**(`options`): `AnniePlayerCore`

Defined in: [annie-player/src/core.ts:119](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L119)

#### Parameters

##### options

[`AnniePlayerOptions`](../type-aliases/AnniePlayerOptions.md)

#### Returns

`AnniePlayerCore`

## Methods

### attachCanvas()

> **attachCanvas**(`canvas`): `void`

Defined in: [annie-player/src/core.ts:129](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L129)

Attach a canvas element to render the animation on.

#### Parameters

##### canvas

`HTMLCanvasElement`

#### Returns

`void`

***

### cleanup()

> **cleanup**(): `void`

Defined in: [annie-player/src/core.ts:471](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L471)

Clean up resources (revoke blob URLs, drop decoded QOI pixels).

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [annie-player/src/core.ts:485](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L485)

Destroy the player and clean up all resources, including those of a
load that's still running.

#### Returns

`void`

***

### detachCanvas()

> **detachCanvas**(): `void`

Defined in: [annie-player/src/core.ts:137](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L137)

Detach the canvas and stop playback.

#### Returns

`void`

***

### getState()

> **getState**(): [`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

Defined in: [annie-player/src/core.ts:146](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L146)

Get the current state of the player.

#### Returns

[`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

***

### load()

> **load**(): `Promise`\<`void`\>

Defined in: [annie-player/src/core.ts:210](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L210)

Load the animation from the source URL.

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**\<`K`\>(`event`, `callback`): () => `void`

Defined in: [annie-player/src/core.ts:161](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L161)

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

Defined in: [annie-player/src/core.ts:342](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L342)

Pause the animation at the current frame.

#### Returns

`void`

***

### play()

> **play**(): `void`

Defined in: [annie-player/src/core.ts:327](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L327)

Start playing the animation from the current frame.

#### Returns

`void`

***

### seek()

> **seek**(`frameIndex`): `void`

Defined in: [annie-player/src/core.ts:370](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L370)

Seek to a specific frame. The frame is drawn immediately. Playback state
is preserved — if playing, playback continues forward from the new frame.

#### Parameters

##### frameIndex

`number`

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [annie-player/src/core.ts:356](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L356)

Stop the animation and reset to the first frame.

#### Returns

`void`
