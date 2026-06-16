[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / RenderReactElementOptions

# Type Alias: RenderReactElementOptions

> **RenderReactElementOptions** = `object`

Defined in: [packages/canvas/src/types.ts:23](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L23)

Options for [renderReactElement](../functions/renderReactElement.md).

## Properties

### debug?

> `optional` **debug**: `boolean`

Defined in: [packages/canvas/src/types.ts:31](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L31)

Draw layout bounding boxes for debugging

***

### emoji?

> `optional` **emoji**: [`EmojiStyle`](EmojiStyle.md) \| `"none"`

Defined in: [packages/canvas/src/types.ts:33](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L33)

Emoji style for rendering emoji characters as images. Defaults to "twemoji". Pass "none" to disable.

***

### fonts?

> `optional` **fonts**: [`FontData`](FontData.md)[]

Defined in: [packages/canvas/src/types.ts:25](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L25)

Font data for text rendering. Defaults to `[]` (system fonts).

***

### height?

> `optional` **height**: `number`

Defined in: [packages/canvas/src/types.ts:29](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L29)

Layout height override. Defaults to `ctx.canvas.height`.

***

### imageCache?

> `optional` **imageCache**: [`ImageCache`](ImageCache.md)

Defined in: [packages/canvas/src/types.ts:55](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L55)

Cache for image loads — `<img>` and `background-image: url(...)` sources.
By default each call creates a fresh cache, so every source is fetched
and decoded anew per call. Pass a persistent cache (`new Map()`) when
calling repeatedly with the same sources — e.g. once per frame inside
`tween(...)` — so each source is loaded once, on first use. Sharing one
cache across concurrent calls is safe: entries are load promises, so
concurrent renders of the same source share a single in-flight fetch.
Failed loads are evicted and retried on the next call. The cache only
grows (successful loads are never evicted) — scope it to a bounded set
of sources, like one animation's frames, not a whole server's lifetime.

***

### userAgent?

> `optional` **userAgent**: `string`

Defined in: [packages/canvas/src/types.ts:42](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L42)

User-Agent header sent on remote (http/https) image fetches — `<img>` and
`background-image: url(...)` sources. When unset, fetch uses its default.
An empty string is passed through as an explicit empty header. Values
containing CR/LF or other invalid header characters will cause fetch to
throw `TypeError`. (Emoji sprites are fetched from public CDNs without
this header.)

***

### width?

> `optional` **width**: `number`

Defined in: [packages/canvas/src/types.ts:27](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L27)

Layout width override. Defaults to `ctx.canvas.width`.
