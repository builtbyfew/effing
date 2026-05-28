[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / loadImage

# Function: loadImage()

> **loadImage**(`source`, `options?`): `Promise`\<`Image`\>

Defined in: [packages/canvas/src/image.ts:34](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/image.ts#L34)

Load an image from a path, Buffer, data URI, or remote URL.

Remote http/https URLs are fetched via global fetch() and passed to the
native loader as bytes — the same path `<img>` sources take in
`renderReactElement`. This keeps `loadImage(url)` and `<img src={url}>`
consistent: both honor a global dispatcher / proxy (undici's
setGlobalDispatcher) and the `userAgent` option. @napi-rs/canvas's own URL
loader uses Node's raw http modules, which bypass any dispatcher, so it is
only used for non-remote sources here.

Note: @napi-rs/canvas's `maxRedirects` / `requestOptions` load options are
intentionally not exposed — they only configure its built-in URL loader,
which this wrapper bypasses. Control remote fetches via fetch/undici instead.

## Parameters

### source

`string` | `ArrayBufferLike` | `Buffer`\<`ArrayBufferLike`\> | `Uint8Array`\<`ArrayBufferLike`\> | `URL` | `Image` | `Readable`

### options?

[`LoadImageOptions`](../interfaces/LoadImageOptions.md)

## Returns

`Promise`\<`Image`\>
