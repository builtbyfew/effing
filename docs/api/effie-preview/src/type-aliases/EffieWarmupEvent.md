[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / EffieWarmupEvent

# Type Alias: EffieWarmupEvent

> **EffieWarmupEvent** = \{ `total`: `number`; `type`: `"start"`; \} \| \{ `data`: `EffieWarmupProgressEvent`; `type`: `"progress"`; \} \| \{ `data`: `EffieWarmupDownloadingEvent`; `type`: `"downloading"`; \} \| \{ `cached`: `number`; `failed`: `number`; `total`: `number`; `type`: `"keepalive"`; \} \| \{ `cached`: `number`; `failed`: `number`; `total`: `number`; `type`: `"summary"`; \} \| \{ `status`: `"ready"`; `type`: `"complete"`; \} \| \{ `message`: `string`; `type`: `"error"`; \}

Defined in: [packages/effie-preview/src/warmup.ts:22](https://github.com/builtbyfew/effing/blob/b46122bc8e003db755cd7f9a9ac0b2b2179d2bdf/packages/effie-preview/src/warmup.ts#L22)

Union of all SSE event types
