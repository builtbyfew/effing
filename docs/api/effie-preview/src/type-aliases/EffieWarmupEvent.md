[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie-preview/src](../README.md) / EffieWarmupEvent

# Type Alias: EffieWarmupEvent

> **EffieWarmupEvent** = \{ `total`: `number`; `type`: `"start"`; \} \| \{ `data`: `EffieWarmupProgressEvent`; `type`: `"progress"`; \} \| \{ `data`: `EffieWarmupDownloadingEvent`; `type`: `"downloading"`; \} \| \{ `cached`: `number`; `failed`: `number`; `total`: `number`; `type`: `"keepalive"`; \} \| \{ `cached`: `number`; `failed`: `number`; `total`: `number`; `type`: `"summary"`; \} \| \{ `status`: `"ready"`; `type`: `"complete"`; \} \| \{ `message`: `string`; `type`: `"error"`; \}

Defined in: [packages/effie-preview/src/warmup.ts:22](https://github.com/builtbyfew/effing/blob/985f5e231cff68bb9579173c6a825fe1c21f4474/packages/effie-preview/src/warmup.ts#L22)

Union of all SSE event types
