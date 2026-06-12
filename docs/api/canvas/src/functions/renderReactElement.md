[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / renderReactElement

# Function: renderReactElement()

> **renderReactElement**(`ctx`, `element`, `options`): `Promise`\<`void`\>

Defined in: [packages/canvas/src/jsx/index.ts:62](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/jsx/index.ts#L62)

Render a React element tree to a canvas context.

Width and height default to `ctx.canvas.width` / `ctx.canvas.height` but
can be overridden via `options.width` and `options.height`. This is useful
for HiDPI rendering where the canvas is larger than the logical layout size.

## Parameters

### ctx

`SKRSContext2D`

Canvas 2D rendering context to draw into

### element

`ReactNode`

React element tree to render

### options

[`RenderReactElementOptions`](../type-aliases/RenderReactElementOptions.md) = `{}`

Rendering options (fonts, dimensions, debug mode)

## Returns

`Promise`\<`void`\>

## Examples

```tsx
import { createCanvas, renderReactElement } from "@effing/canvas";

const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext("2d");

await renderReactElement(ctx, <MyComponent />, { fonts: [myFont] });

const png = await canvas.encode("png");
```

```tsx
const dpr = 2;
const canvas = createCanvas(1080 * dpr, 1080 * dpr);
const ctx = canvas.getContext("2d");
ctx.scale(dpr, dpr);

await renderReactElement(ctx, <MyComponent />, {
  fonts: [myFont],
  width: 1080,
  height: 1080,
});
```

```tsx
await renderReactElement(ctx, <MyComponent />, {
  userAgent: "my-renderer/1.0",
});
```

```tsx
const imageCache: ImageCache = new Map();
for (let frame = 0; frame < frameCount; frame++) {
  await renderReactElement(ctx, <Frame n={frame} />, { fonts, imageCache });
}
```
