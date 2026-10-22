[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [effie/src](../README.md) / EffieMotion

# Type Alias: EffieMotion

> **EffieMotion** = `object` & (\{ `amplitude?`: `number`; `type`: `"bounce"`; \} \| \{ `frequency?`: `number`; `intensity?`: `number`; `type`: `"shake"`; \} \| \{ `direction`: `"left"` \| `"right"` \| `"up"` \| `"down"`; `distance?`: `number`; `easing?`: `"linear"` \| `"ease-in"` \| `"ease-out"` \| `"ease-in-out"`; `reverse?`: `boolean`; `type`: `"slide"`; \})

Defined in: [effie/src/types.ts:124](https://github.com/builtbyfew/effing/blob/main/packages/effie/src/types.ts#L124)

## Type Declaration

### duration?

> `optional` **duration?**: `number`

How long the motion lasts, in seconds (default 1).

### start?

> `optional` **start?**: `number`

When the motion begins (default 0), in seconds from when the layer's
content starts at segment time `delay`.
