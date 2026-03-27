[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / RenderReactElementOptions

# Type Alias: RenderReactElementOptions

> **RenderReactElementOptions** = `object`

Defined in: [packages/canvas/src/types.ts:22](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L22)

Options for [renderReactElement](../functions/renderReactElement.md).

## Properties

### debug?

> `optional` **debug**: `boolean`

Defined in: [packages/canvas/src/types.ts:30](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L30)

Draw layout bounding boxes for debugging

***

### emoji?

> `optional` **emoji**: [`EmojiStyle`](EmojiStyle.md) \| `"none"`

Defined in: [packages/canvas/src/types.ts:32](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L32)

Emoji style for rendering emoji characters as images. Defaults to "twemoji". Pass "none" to disable.

***

### fonts?

> `optional` **fonts**: [`FontData`](FontData.md)[]

Defined in: [packages/canvas/src/types.ts:24](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L24)

Font data for text rendering. Defaults to `[]` (system fonts).

***

### height?

> `optional` **height**: `number`

Defined in: [packages/canvas/src/types.ts:28](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L28)

Layout height override. Defaults to `ctx.canvas.height`.

***

### width?

> `optional` **width**: `number`

Defined in: [packages/canvas/src/types.ts:26](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/types.ts#L26)

Layout width override. Defaults to `ctx.canvas.width`.
