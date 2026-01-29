[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRendererOptions

# Type Alias: EffieRendererOptions

> **EffieRendererOptions** = `object`

Defined in: [packages/ffs/src/render.ts:16](https://github.com/builtbyfew/effing/blob/5e3417b5327b56ef65ec8a7ca2c6cb048f7bca02/packages/ffs/src/render.ts#L16)

## Properties

### allowLocalFiles?

> `optional` **allowLocalFiles**: `boolean`

Defined in: [packages/ffs/src/render.ts:23](https://github.com/builtbyfew/effing/blob/5e3417b5327b56ef65ec8a7ca2c6cb048f7bca02/packages/ffs/src/render.ts#L23)

Allow reading from local file paths.
WARNING: Only enable this for trusted internal operations.
Enabling this for user-provided data is a security risk.

#### Default

```ts
false
```

***

### cacheStorage?

> `optional` **cacheStorage**: `CacheStorage`

Defined in: [packages/ffs/src/render.ts:28](https://github.com/builtbyfew/effing/blob/5e3417b5327b56ef65ec8a7ca2c6cb048f7bca02/packages/ffs/src/render.ts#L28)

Cache storage instance for source lookups.
If not provided, a shared lazy-initialized cache will be used.

***

### httpProxy?

> `optional` **httpProxy**: `HttpProxy`

Defined in: [packages/ffs/src/render.ts:35](https://github.com/builtbyfew/effing/blob/5e3417b5327b56ef65ec8a7ca2c6cb048f7bca02/packages/ffs/src/render.ts#L35)

HTTP proxy for video/audio URLs.
When provided, HTTP(S) URLs for video/audio inputs will be routed
through this proxy, allowing Node.js to handle DNS resolution
instead of FFmpeg (useful for Alpine Linux with musl libc).
