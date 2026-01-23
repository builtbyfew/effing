[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / EffieBackground

# Type Alias: EffieBackground\<S, U\>

> **EffieBackground**\<`S`, `U`\> = \{ `source`: [`EffieSource`](EffieSource.md)\<`S`, `U`\>; `type`: `"image"`; \} \| \{ `seek?`: `number`; `source`: [`EffieSource`](EffieSource.md)\<`S`, `U`\>; `type`: `"video"`; \} \| \{ `color`: `string`; `type`: `"color"`; \}

Defined in: [packages/effie/src/types.ts:30](https://github.com/builtbyfew/effing/blob/985f5e231cff68bb9579173c6a825fe1c21f4474/packages/effie/src/types.ts#L30)

## Type Parameters

### S

`S` *extends* [`EffieSources`](EffieSources.md)\<`U`\>

### U

`U` *extends* `string` = [`EffieWebUrl`](EffieWebUrl.md)
