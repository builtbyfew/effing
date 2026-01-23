[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieDataForJoin

# Function: effieDataForJoin()

> **effieDataForJoin**\<`U`, `V`\>(`effieData`, `segmentSourceUrls`): [`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\<`U` \| `V`\>, `U` \| `V`\>

Defined in: [packages/effie/src/partition.ts:100](https://github.com/builtbyfew/effing/blob/d4d0b72ff03d40e85501fd9e6ca0b75564cb7252/packages/effie/src/partition.ts#L100)

Returns EffieData for joining pre-rendered segments into a final video.
Each segment uses its corresponding pre-rendered video as both background and audio source.

## Type Parameters

### U

`U` *extends* `string` = [`EffieWebUrl`](../type-aliases/EffieWebUrl.md)

### V

`V` *extends* `string` = [`EffieWebUrl`](../type-aliases/EffieWebUrl.md)

## Parameters

### effieData

[`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\<`U`\>, `U`\>

The original EffieData with segment metadata (durations, transitions)

### segmentSourceUrls

`V`[]

URLs to pre-rendered segment videos (one per segment)

## Returns

[`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\<`U` \| `V`\>, `U` \| `V`\>
