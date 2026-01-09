[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [ffs/src](../README.md) / EffieRendererOptions

# Type Alias: EffieRendererOptions

> **EffieRendererOptions** = `object`

Defined in: packages/ffs/src/render.ts:15

## Properties

### allowLocalFiles?

> `optional` **allowLocalFiles**: `boolean`

Defined in: packages/ffs/src/render.ts:22

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

Defined in: packages/ffs/src/render.ts:27

Cache storage instance for source lookups.
If not provided, a shared lazy-initialized cache will be used.
