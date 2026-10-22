[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRendererOptions

# Type Alias: EffieRendererOptions

> **EffieRendererOptions** = `object`

Defined in: [ffs/src/renderer.ts:121](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L121)

## Properties

### allowLocalFiles?

> `optional` **allowLocalFiles?**: `boolean`

Defined in: [ffs/src/renderer.ts:128](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L128)

Allow reading from local file paths.
WARNING: Only enable this for trusted internal operations.
Enabling this for user-provided data is a security risk.

#### Default

```ts
false
```

***

### httpProxy?

> `optional` **httpProxy?**: `HttpProxy` \| `false`

Defined in: [ffs/src/renderer.ts:146](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L146)

HTTP proxy for video/audio URLs.
HTTP(S) URLs for video/audio inputs are routed through this proxy, so
Node.js handles DNS resolution (musl/Alpine) and TLS instead of FFmpeg.
Since FFmpeg 9.0 the bundled binary verifies TLS peers by default but its
mbedTLS backend has no system CA store, so https inputs opened by FFmpeg
directly fail certificate verification.

When omitted, each render starts its own proxy and closes it once the
render ends. Pass a shared proxy to reuse one across renders, or `false`
to let FFmpeg open these URLs itself.

***

### transientStore?

> `optional` **transientStore?**: `TransientStore`

Defined in: [ffs/src/renderer.ts:133](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L133)

Transient store instance for source lookups.
If not provided, sources will be fetched directly from network.
