[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / EffieBackground

# Type Alias: EffieBackground\<S, U\>

> **EffieBackground**\<`S`, `U`\> = \{ `source`: [`EffieSource`](EffieSource.md)\<`S`, `U`\>; `type`: `"image"`; \} \| \{ `seek?`: `number`; `source`: [`EffieSource`](EffieSource.md)\<`S`, `U`\>; `type`: `"video"`; \} \| \{ `color`: `string`; `type`: `"color"`; \}

Defined in: [packages/effie/src/types.ts:30](https://github.com/builtbyfew/effing/blob/b95b8037f746d8f2d1f3d4bcb2f1a6a9f0ee95ec/packages/effie/src/types.ts#L30)

## Type Parameters

### S

`S` *extends* [`EffieSources`](EffieSources.md)\<`U`\>

### U

`U` *extends* `string` = [`EffieWebUrl`](EffieWebUrl.md)
