[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / EffieWarmupState

# Type Alias: EffieWarmupState

> **EffieWarmupState** = `object`

Defined in: packages/effie-preview/src/warmup.ts:32

Current warmup state

## Properties

### cached

> **cached**: `number`

Defined in: packages/effie-preview/src/warmup.ts:35

***

### downloading

> **downloading**: `Map`\<`string`, \{ `bytesReceived`: `number`; `url`: `string`; \}\>

Defined in: packages/effie-preview/src/warmup.ts:37

***

### endTime?

> `optional` **endTime**: `number`

Defined in: packages/effie-preview/src/warmup.ts:40

***

### error?

> `optional` **error**: `string`

Defined in: packages/effie-preview/src/warmup.ts:38

***

### failed

> **failed**: `number`

Defined in: packages/effie-preview/src/warmup.ts:36

***

### startTime?

> `optional` **startTime**: `number`

Defined in: packages/effie-preview/src/warmup.ts:39

***

### status

> **status**: `"idle"` \| `"connecting"` \| `"warming"` \| `"ready"` \| `"error"`

Defined in: packages/effie-preview/src/warmup.ts:33

***

### total

> **total**: `number`

Defined in: packages/effie-preview/src/warmup.ts:34
