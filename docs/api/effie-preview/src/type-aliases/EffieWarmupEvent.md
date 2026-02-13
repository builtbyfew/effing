[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / EffieWarmupEvent

# Type Alias: EffieWarmupEvent

> **EffieWarmupEvent** = `{ [K in keyof WarmupEventMap & string]: { data: WarmupEventMap[K]; type: K } }`\[keyof `WarmupEventMap` & `string`\]

Defined in: [packages/effie-preview/src/warmup.ts:10](https://github.com/builtbyfew/effing/blob/main/packages/effie-preview/src/warmup.ts#L10)

Union of all warmup SSE event types, derived from the server-side
`WarmupEventMap` so the client stays in sync automatically.
Each variant is `{ type: K; data: WarmupEventMap[K] }`.
