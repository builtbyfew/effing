[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieDataForSegment

# Function: effieDataForSegment()

> **effieDataForSegment**(`effieData`, `segmentIndex`): [`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\>

Defined in: [packages/effie/src/partition.ts:7](https://github.com/builtbyfew/effing/blob/6f6d4d59b2bb5b919f5667b1c43ff3cdcd9e6b95/packages/effie/src/partition.ts#L7)

Returns a minimal EffieData containing only what's needed to render a single segment.
Can be used for distributed rendering where each segment is rendered independently.

## Parameters

### effieData

[`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\>

### segmentIndex

`number`

## Returns

[`EffieData`](../type-aliases/EffieData.md)\<[`EffieSources`](../type-aliases/EffieSources.md)\>
