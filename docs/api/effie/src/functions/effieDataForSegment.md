[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieDataForSegment

# Function: effieDataForSegment()

> **effieDataForSegment**(`effieData`, `segmentIndex`): [`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\>

Defined in: [packages/effie/src/partition.ts:7](https://github.com/builtbyfew/effing/blob/ba28b98e4b8d1cee14453ddc43bc0c37de0f8355/packages/effie/src/partition.ts#L7)

Returns a minimal EffieData containing only what's needed to render a single segment.
Can be used for distributed rendering where each segment is rendered independently.

## Parameters

### effieData

[`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\>

### segmentIndex

`number`

## Returns

[`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\>
