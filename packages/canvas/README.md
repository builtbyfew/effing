# @effing/canvas

**Server-side canvas with JSX and Lottie support.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Render React JSX elements and Lottie animations directly to a canvas using [@napi-rs/canvas](https://github.com/nicolo-ribaudo/napi-rs-canvas) (Rust-based Skia bindings). Includes Yoga flex layout, emoji support, font management, and frame-level Lottie rendering.

## Installation

```bash
npm install @effing/canvas
```

Requires the `@napi-rs/canvas` peer dependency (typically installed automatically though):

```bash
npm install @napi-rs/canvas
```

## Quick Start

```typescript
import { createCanvas, renderReactElement, type FontData } from "@effing/canvas";
import fs from "node:fs";

const font: FontData = {
  name: "Inter",
  data: await fs.readFile("./fonts/Inter-Regular.ttf"),
  weight: 400,
  style: "normal",
};

const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext("2d");

await renderReactElement(
  ctx,
  <div
    style={{
      width: 1080,
      height: 1080,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1a1a2e",
      color: "white",
      fontSize: 64,
    }}
  >
    Hello World!
  </div>,
  { fonts: [font] },
);

const png = await canvas.encode("png");
await fs.writeFile("output.png", png);
```

## Concepts

### Rendering Pipeline

```
JSX → Yoga layout → Skia canvas → PNG
```

1. **Yoga** calculates flex layout from your JSX tree (flexbox, positioning, text measurement)
2. **Skia** draws each node to a canvas context (backgrounds, borders, text, images, SVG, gradients)
3. **Encode** the canvas to PNG or JPEG via `canvas.encode()` or `canvas.encodeSync()`

Canvas dimensions are taken from the context itself (`ctx.canvas.width` / `ctx.canvas.height`), so there are no `width`/`height` options — just create a canvas at the size you need.

### Font Loading

Fonts must be registered before rendering text. You can pass them via the `fonts` option (registered automatically), or register them manually:

```typescript
import {
  registerFont,
  registerFontFromPath,
  registeredFamilies,
} from "@effing/canvas";

// From a buffer
registerFont({ name: "Inter", data: fontBuffer, weight: 400, style: "normal" });

// From a file path
registerFontFromPath("./fonts/Inter-Bold.ttf", "Inter");

// Check what's registered
console.log(registeredFamilies()); // ["Inter", ...]
```

### Emoji Support

Emoji characters are automatically rendered as images from CDNs. Supported styles:

| Style        | Source                         |
| ------------ | ------------------------------ |
| `twemoji`    | Twitter Emoji (default)        |
| `openmoji`   | OpenMoji                       |
| `blobmoji`   | Google Blob Emoji              |
| `noto`       | Google Noto Emoji              |
| `fluent`     | Microsoft Fluent Emoji (color) |
| `fluentFlat` | Microsoft Fluent Emoji (flat)  |

Pass `emoji: "none"` to disable emoji image rendering.

### Lottie Animations

Render individual frames of Lottie animations to a canvas:

```typescript
import { createCanvas, loadLottie, renderLottieFrame } from "@effing/canvas";

const anim = loadLottie(fs.readFileSync("animation.json", "utf-8"));

const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext("2d");

renderLottieFrame(ctx, anim, 0); // render frame 0
const png = canvas.encodeSync("png");
```

## API Overview

### `createCanvas(width, height)`

Create a new canvas. Re-exported from `@napi-rs/canvas`.

```typescript
function createCanvas(width: number, height: number): Canvas;
```

### `renderReactElement(ctx, element, options)`

Render a React element tree to a canvas context.

```typescript
function renderReactElement(
  ctx: SKRSContext2D,
  element: ReactNode,
  options: RenderReactElementOptions,
): Promise<void>;
```

### `loadLottie(data, options?)`

Load a Lottie animation from a JSON string or Buffer.

```typescript
function loadLottie(
  data: string | Buffer,
  options?: { resourcePath?: string },
): LottieAnimation;
```

### `renderLottieFrame(ctx, animation, frame)`

Render a specific frame of a Lottie animation to a canvas context.

```typescript
function renderLottieFrame(
  ctx: SKRSContext2D,
  animation: LottieAnimation,
  frame: number,
): void;
```

### Font Helpers

- `registerFont(font)` — Register a font from a `FontData` buffer (idempotent)
- `registerFontFromPath(path, nameAlias?)` — Register a font from a file path
- `registeredFamilies()` — Get registered font family names

### Options

| Option  | Type                   | Required | Description                              |
| ------- | ---------------------- | -------- | ---------------------------------------- |
| `fonts` | `FontData[]`           | Yes      | Font data for text rendering             |
| `debug` | `boolean`              | No       | Draw layout bounding boxes for debugging |
| `emoji` | `EmojiStyle \| "none"` | No       | Emoji style (default: `"twemoji"`)       |

### Types

```typescript
type FontData = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

type EmojiStyle =
  | "twemoji"
  | "openmoji"
  | "blobmoji"
  | "noto"
  | "fluent"
  | "fluentFlat";
```

Also re-exports from `@napi-rs/canvas`: `Canvas`, `SKRSContext2D`, `GlobalFonts`, `loadImage`, `Image`, `LottieAnimation`.

## Examples

### Animation Frames with Tween

```typescript
import { createCanvas, renderReactElement } from "@effing/canvas";
import { tween, easeOutQuad } from "@effing/tween";
import { annieStream } from "@effing/annie";

async function* generateFrames() {
  yield* tween(90, async ({ lower: progress }) => {
    const scale = 1 + 0.3 * easeOutQuad(progress);

    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext("2d");

    await renderReactElement(
      ctx,
      <div
        style={{
          width: 1080,
          height: 1920,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale})`,
          fontSize: 72,
          color: "white",
          backgroundColor: "#1a1a2e",
        }}
      >
        Animated!
      </div>,
      { fonts },
    );

    return canvas.encode("png");
  });
}

const stream = annieStream(generateFrames());
```

### Lottie Animation to Frames

```typescript
import { createCanvas, loadLottie, renderLottieFrame } from "@effing/canvas";

const anim = loadLottie(fs.readFileSync("confetti.json", "utf-8"));
const totalFrames = 60;

for (let i = 0; i < totalFrames; i++) {
  const canvas = createCanvas(1080, 1080);
  const ctx = canvas.getContext("2d");

  renderLottieFrame(ctx, anim, i);

  const png = canvas.encodeSync("png");
  fs.writeFileSync(`frame-${String(i).padStart(3, "0")}.png`, png);
}
```

### Debug Mode

Pass `debug: true` to visualize layout bounding boxes:

```typescript
await renderReactElement(ctx, <MyComponent />, {
  fonts,
  debug: true,
});
```

## Related Packages

- [`@effing/tween`](../tween) — Step iteration and easing for frame generation
- [`@effing/annie`](../annie) — Package rendered frames into animations
- [`@effing/satori`](../satori) — Alternative JSX-to-PNG renderer (Satori + Resvg)
