[**Effing API Reference**](../../../README.md)

***

[Effing API Reference](../../../README.md) / [canvas/src](../README.md) / renderLottieFrame

# Function: renderLottieFrame()

> **renderLottieFrame**(`ctx`, `animation`, `frame`): `void`

Defined in: [packages/canvas/src/lottie.ts:50](https://github.com/builtbyfew/effing/blob/main/packages/canvas/src/lottie.ts#L50)

Render a specific frame of a Lottie animation to a canvas context.

Seeks the animation to the given frame, then renders it onto the
provided context. The canvas dimensions determine the render size.

## Parameters

### ctx

`SKRSContext2D`

Canvas 2D rendering context to draw into

### animation

`LottieAnimation`

Lottie animation handle (from [loadLottie](loadLottie.md))

### frame

`number`

Zero-based frame number to render

## Returns

`void`

## Example

```ts
import { createCanvas, loadLottie, renderLottieFrame } from "@effing/canvas";

const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext("2d");
const anim = loadLottie(jsonString);

renderLottieFrame(ctx, anim, 0);
const png = canvas.encodeSync("png");
```
