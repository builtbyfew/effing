[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRendererOptions

# Type Alias: EffieRendererOptions

> **EffieRendererOptions** = `object`

Defined in: [packages/ffs/src/renderer.ts:17](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L17)

## Properties

### allowLocalFiles?

> `optional` **allowLocalFiles**: `boolean`

Defined in: [packages/ffs/src/renderer.ts:24](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L24)

Allow reading from local file paths.
WARNING: Only enable this for trusted internal operations.
Enabling this for user-provided data is a security risk.

#### Default

```ts
false
```

***

### httpProxy?

> `optional` **httpProxy**: `HttpProxy`

Defined in: [packages/ffs/src/renderer.ts:36](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L36)

HTTP proxy for video/audio URLs.
When provided, HTTP(S) URLs for video/audio inputs will be routed
through this proxy, allowing Node.js to handle DNS resolution
instead of FFmpeg (useful for Alpine Linux with musl libc).

***

### transientStore?

> `optional` **transientStore**: `TransientStore`

Defined in: [packages/ffs/src/renderer.ts:29](https://github.com/builtbyfew/effing/blob/main/packages/ffs/src/renderer.ts#L29)

Transient store instance for source lookups.
If not provided, sources will be fetched directly from network.
