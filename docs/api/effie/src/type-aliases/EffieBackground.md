[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / EffieBackground

# Type Alias: EffieBackground\<S, U\>

> **EffieBackground**\<`S`, `U`\> = \{ `source`: [`EffieSource`](EffieSource.md)\<`S`, `U`\>; `type`: `"image"`; \} \| \{ `seek?`: `number`; `source`: [`EffieSource`](EffieSource.md)\<`S`, `U`\>; `type`: `"video"`; \} \| \{ `color`: `string`; `type`: `"color"`; \}

Defined in: [packages/effie/src/types.ts:30](https://github.com/builtbyfew/effing/blob/65076cf01746394f11c666361bc1163baad0b61b/packages/effie/src/types.ts#L30)

## Type Parameters

### S

`S` *extends* [`EffieSources`](EffieSources.md)\<`U`\>

### U

`U` *extends* `string` = [`EffieWebUrl`](EffieWebUrl.md)
