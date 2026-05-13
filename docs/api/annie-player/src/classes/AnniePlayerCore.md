[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / AnniePlayerCore

# Class: AnniePlayerCore

Defined in: [packages/annie-player/src/core.ts:31](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L31)

Framework-agnostic Annie animation player.
Handles loading TAR archives of image frames and playing them on a canvas.

## Constructors

### Constructor

> **new AnniePlayerCore**(`options`): `AnniePlayerCore`

Defined in: [packages/annie-player/src/core.ts:56](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L56)

#### Parameters

##### options

[`AnniePlayerOptions`](../type-aliases/AnniePlayerOptions.md)

#### Returns

`AnniePlayerCore`

## Methods

### attachCanvas()

> **attachCanvas**(`canvas`): `void`

Defined in: [packages/annie-player/src/core.ts:66](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L66)

Attach a canvas element to render the animation on.

#### Parameters

##### canvas

`HTMLCanvasElement`

#### Returns

`void`

***

### cleanup()

> **cleanup**(): `void`

Defined in: [packages/annie-player/src/core.ts:325](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L325)

Clean up resources (revoke blob URLs).

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [packages/annie-player/src/core.ts:337](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L337)

Destroy the player and clean up all resources.

#### Returns

`void`

***

### detachCanvas()

> **detachCanvas**(): `void`

Defined in: [packages/annie-player/src/core.ts:74](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L74)

Detach the canvas and stop playback.

#### Returns

`void`

***

### getState()

> **getState**(): [`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

Defined in: [packages/annie-player/src/core.ts:83](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L83)

Get the current state of the player.

#### Returns

[`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

***

### load()

> **load**(): `Promise`\<`void`\>

Defined in: [packages/annie-player/src/core.ts:147](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L147)

Load the animation from the source URL.

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**\<`K`\>(`event`, `callback`): () => `void`

Defined in: [packages/annie-player/src/core.ts:98](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L98)

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

> (): `void`

##### Returns

`void`

***

### pause()

> **pause**(): `void`

Defined in: [packages/annie-player/src/core.ts:239](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L239)

Pause the animation at the current frame.

#### Returns

`void`

***

### play()

> **play**(): `void`

Defined in: [packages/annie-player/src/core.ts:226](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L226)

Start playing the animation from the current frame.

#### Returns

`void`

***

### seek()

> **seek**(`frameIndex`): `void`

Defined in: [packages/annie-player/src/core.ts:267](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L267)

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

Defined in: [packages/annie-player/src/core.ts:253](https://github.com/builtbyfew/effing/blob/main/packages/annie-player/src/core.ts#L253)

Stop the animation and reset to the first frame.

#### Returns

`void`
