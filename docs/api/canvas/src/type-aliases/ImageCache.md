[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / ImageCache

# Type Alias: ImageCache

> **ImageCache** = `Map`\<`string`, `Promise`\<`Image`\>\>

Defined in: [packages/canvas/src/image.ts:54](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/image.ts#L54)

Per-render cache of image load promises, keyed by source string.
Shared between layout and draw phases to avoid duplicate loads.
