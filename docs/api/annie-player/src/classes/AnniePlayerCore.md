[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [annie-player/src](../README.md) / AnniePlayerCore

# Class: AnniePlayerCore

Defined in: [packages/annie-player/src/core.ts:30](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L30)

Framework-agnostic Annie animation player.
Handles loading TAR archives of image frames and playing them on a canvas.

## Constructors

### Constructor

> **new AnniePlayerCore**(`options`): `AnniePlayerCore`

Defined in: [packages/annie-player/src/core.ts:55](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L55)

#### Parameters

##### options

[`AnniePlayerOptions`](../type-aliases/AnniePlayerOptions.md)

#### Returns

`AnniePlayerCore`

## Methods

### attachCanvas()

> **attachCanvas**(`canvas`): `void`

Defined in: [packages/annie-player/src/core.ts:65](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L65)

Attach a canvas element to render the animation on.

#### Parameters

##### canvas

`HTMLCanvasElement`

#### Returns

`void`

***

### cleanup()

> **cleanup**(): `void`

Defined in: [packages/annie-player/src/core.ts:301](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L301)

Clean up resources (revoke blob URLs).

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [packages/annie-player/src/core.ts:313](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L313)

Destroy the player and clean up all resources.

#### Returns

`void`

***

### detachCanvas()

> **detachCanvas**(): `void`

Defined in: [packages/annie-player/src/core.ts:73](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L73)

Detach the canvas and stop playback.

#### Returns

`void`

***

### getState()

> **getState**(): [`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

Defined in: [packages/annie-player/src/core.ts:82](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L82)

Get the current state of the player.

#### Returns

[`AnniePlayerState`](../type-aliases/AnniePlayerState.md)

***

### load()

> **load**(): `Promise`\<`void`\>

Defined in: [packages/annie-player/src/core.ts:145](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L145)

Load the animation from the source URL.

#### Returns

`Promise`\<`void`\>

***

### on()

> **on**\<`K`\>(`event`, `callback`): () => `void`

Defined in: [packages/annie-player/src/core.ts:96](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L96)

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

Defined in: [packages/annie-player/src/core.ts:237](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L237)

Pause the animation.

#### Returns

`void`

***

### play()

> **play**(): `void`

Defined in: [packages/annie-player/src/core.ts:224](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L224)

Start playing the animation.

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [packages/annie-player/src/core.ts:251](https://github.com/builtbyfew/effing/blob/2e9a54cdce7ecc77e7980390cfb8bd3f8b6cce3e/packages/annie-player/src/core.ts#L251)

Stop the animation and reset to the beginning.

#### Returns

`void`
