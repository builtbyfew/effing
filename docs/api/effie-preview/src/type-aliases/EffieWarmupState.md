[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / EffieWarmupState

# Type Alias: EffieWarmupState

> **EffieWarmupState** = `object`

Defined in: [packages/effie-preview/src/warmup.ts:15](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L15)

Current warmup state

## Properties

### cached

> **cached**: `number`

Defined in: [packages/effie-preview/src/warmup.ts:18](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L18)

***

### downloading

> **downloading**: `Map`\<`string`, \{ `bytesReceived`: `number`; `url`: `string`; \}\>

Defined in: [packages/effie-preview/src/warmup.ts:21](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L21)

***

### endTime?

> `optional` **endTime**: `number`

Defined in: [packages/effie-preview/src/warmup.ts:24](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L24)

***

### error?

> `optional` **error**: `string`

Defined in: [packages/effie-preview/src/warmup.ts:22](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L22)

***

### failed

> **failed**: `number`

Defined in: [packages/effie-preview/src/warmup.ts:19](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L19)

***

### skipped

> **skipped**: `number`

Defined in: [packages/effie-preview/src/warmup.ts:20](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L20)

***

### startTime?

> `optional` **startTime**: `number`

Defined in: [packages/effie-preview/src/warmup.ts:23](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L23)

***

### status

> **status**: `"idle"` \| `"connecting"` \| `"warming"` \| `"ready"` \| `"error"`

Defined in: [packages/effie-preview/src/warmup.ts:16](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L16)

***

### total

> **total**: `number`

Defined in: [packages/effie-preview/src/warmup.ts:17](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L17)
