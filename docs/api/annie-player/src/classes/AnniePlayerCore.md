[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / AnniePlayerCore

# Class: AnniePlayerCore

Defined in: [annie-player/src/core.ts:95](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L95)

Framework-agnostic Annie animation player.
Handles loading TAR archives of image frames and playing them on a canvas.

## Constructors

### Constructor

> **new AnniePlayerCore**(`options`): `AnniePlayerCore`

Defined in: [annie-player/src/core.ts:122](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L122)

#### Parameters

##### options

[`AnniePlayerOptions`](../type-aliases/AnniePlayerOptions.md)

#### Returns

`AnniePlayerCore`

## Methods

### attachCanvas()

> **attachCanvas**(`canvas`): `void`

Defined in: [annie-player/src/core.ts:141](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L141)

Attach a canvas element to render the animation on.

#### Parameters

##### canvas

`HTMLCanvasElement`

#### Returns

`void`

***

### cleanup()

> **cleanup**(): `void`

Defined in: [annie-player/src/core.ts:505](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L505)

Clean up resources (revoke blob URLs, drop decoded QOI pixels).

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [annie-player/src/core.ts:519](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L519)

Destroy the player and clean up all resources, including those of a
load that's still running.

#### Returns

`void`

***

### detachCanvas()

> **detachCanvas**(): `void`

Defined in: [annie-player/src/core.ts:149](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L149)

Detach the canvas and stop playback.

#### Returns

`void`

***

### getState()

> **getState**(): [`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

Defined in: [annie-player/src/core.ts:158](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L158)

Get the current state of the player.

#### Returns

[`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

***

### load()

> **load**(): `Promise`\<`void`\>

Defined in: [annie-player/src/core.ts:225](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L225)

Load the animation from the source URL.

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**\<`K`\>(`event`, `callback`): () => `void`

Defined in: [annie-player/src/core.ts:173](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L173)

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

Defined in: [annie-player/src/core.ts:362](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L362)

Pause the animation at the current frame.

#### Returns

`void`

***

### play()

> **play**(): `void`

Defined in: [annie-player/src/core.ts:342](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L342)

Start playing the animation from the current frame.

#### Returns

`void`

***

### seek()

> **seek**(`frameIndex`): `void`

Defined in: [annie-player/src/core.ts:395](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L395)

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

Defined in: [annie-player/src/core.ts:133](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L133)

Change the playback frame rate. It applies from the next frame, without
reloading or interrupting playback.

#### Parameters

##### fps

`number`

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [annie-player/src/core.ts:381](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L381)

Stop the animation and reset to the first frame.

#### Returns

`void`
