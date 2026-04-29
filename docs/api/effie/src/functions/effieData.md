[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / effieData

# Function: effieData()

> **effieData**\<`S`\>(`data`): [`EffieData`](../type-aliases/EffieData.md)\<`S`, [`EffieWebUrl`](../type-aliases/EffieWebUrl.md)\>

Defined in: [packages/effie/src/types.ts:166](https://github.com/builtbyfew/effing/blob/main/packages/effie/src/types.ts#L166)

Identity helper that returns its argument with sharper TypeScript inference
for `EffieData` — especially the `#ref` literal types derived from `sources`.
No runtime validation is performed.

For the full Effie format reference — units, ranges, defaults, the
`EffieBackground` / `EffieAudio` / `EffieSegment` / `EffieLayer` /
`EffieTransition` / `EffieEffect` / `EffieMotion` variants, source `#refs`,
and runtime-enforced constraints — see the `@effing/effie` README.

For runtime validation, use `effieDataSchema.safeParse(...)` from this same
package (zod is an optional peer dependency).

## Type Parameters

### S

`S` *extends* [`EffieSources`](../type-aliases/EffieSources.md)\<[`EffieWebUrl`](../type-aliases/EffieWebUrl.md)\>

## Parameters

### data

[`EffieData`](../type-aliases/EffieData.md)\<`S`\>

## Returns

[`EffieData`](../type-aliases/EffieData.md)\<`S`, [`EffieWebUrl`](../type-aliases/EffieWebUrl.md)\>
