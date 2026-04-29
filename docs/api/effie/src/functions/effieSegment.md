[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieSegment

# Function: effieSegment()

> **effieSegment**\<`S`\>(`segment`): [`EffieSegment`](../type-aliases/EffieSegment.md)\<`S`, [`EffieWebUrl`](../type-aliases/EffieWebUrl.md)\>

Defined in: [packages/effie/src/types.ts:187](https://github.com/builtbyfew/effing/blob/main/packages/effie/src/types.ts#L187)

Identity helper that returns its argument with sharper TypeScript inference
for an `EffieSegment` — handy when building segments separately from the
enclosing `EffieData`. No runtime validation is performed.

For segment semantics (duration, layer stacking, per-segment background and
audio overrides, transitions and the rule that the first segment's
transition is ignored) and the full Effie format reference, see the
`@effing/effie` README. For runtime validation, use `effieSegmentSchema` or
the top-level `effieDataSchema`.

## Type Parameters

### S

`S` *extends* [`EffieSources`](../type-aliases/EffieSources.md)\<[`EffieWebUrl`](../type-aliases/EffieWebUrl.md)\>

## Parameters

### segment

[`EffieSegment`](../type-aliases/EffieSegment.md)\<`S`\>

## Returns

[`EffieSegment`](../type-aliases/EffieSegment.md)\<`S`, [`EffieWebUrl`](../type-aliases/EffieWebUrl.md)\>
