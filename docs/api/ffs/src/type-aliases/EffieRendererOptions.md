[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRendererOptions

# Type Alias: EffieRendererOptions

> **EffieRendererOptions** = `object`

Defined in: [ffs/src/renderer.ts:160](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L160)

## Properties

### allowLocalFiles?

> `optional` **allowLocalFiles?**: `boolean`

Defined in: [ffs/src/renderer.ts:167](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L167)

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

Defined in: [ffs/src/renderer.ts:185](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L185)

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

Defined in: [ffs/src/renderer.ts:172](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L172)

Transient store instance for source lookups.
If not provided, sources will be fetched directly from network.
