# @effing/canvas

**Server-side canvas with JSX, SVG, and Lottie support.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

A canvas that can render JSX elements and Lottie animations, powered by Skia (via [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas)) and Yoga flexbox layout. Supports emoji, font management, and CSS properties including transforms, gradients, and text effects.

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

## Font Loading

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

## Emoji Support

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

## Fit Text

Find the largest font size that keeps text within a bounding box, using binary search over the built-in text layout engine:

```typescript
import { findLargestUsableFontSize } from "@effing/canvas";

const fontSize = findLargestUsableFontSize({
  text: "Hello World",
  font,
  maxWidth: 500,
  maxHeight: 100,
});
```

Supports optional `lineHeight` (`"normal"` or a numeric multiplier), `minFontSize` (default 1), and `maxFontSize` (default 1000).

## Inline SVG

Use SVG markup directly in JSX — no need to convert icons to data URLs or `backgroundImage`. The `<svg>` element is sized from its `width`/`height` props (or derived from `viewBox` if only one is given), and its children render in SVG coordinate space rather than flex layout.

```typescript
await renderReactElement(
  ctx,
  <div
    style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffffff" }}
  >
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 17v-3h-20" />
      <path d="M2 8v9" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
    <span>Truck</span>
  </div>,
  { fonts },
);
```

Supported elements: `<path>`, `<circle>`, `<rect>`, `<line>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<g>`, `<defs>`, `<clipPath>`, `<mask>`, `<filter>`, `<linearGradient>`, `<radialGradient>`.

Supported presentation props: `fill`, `stroke`, `strokeWidth`, `strokeLinecap`, `strokeLinejoin`, `strokeOpacity`, `fillOpacity`, `opacity`, `transform`, `clipPath`, `mask`, `filter`. `currentColor` resolves to the inherited CSS `color`, so SVG icons recolor with their surrounding text.

## Lottie Animations

Render individual frames of Lottie animations to a canvas:

```typescript
import { createCanvas, loadLottie, renderLottieFrame } from "@effing/canvas";

const anim = loadLottie(fs.readFileSync("animation.json", "utf-8"));

const canvas = createCanvas(1080, 1080);
const ctx = canvas.getContext("2d");

renderLottieFrame(ctx, anim, 0); // render frame 0
const png = canvas.encodeSync("png");
```

## Supported CSS Properties

### Layout

| Property                         | Values / Notes                                      |
| -------------------------------- | --------------------------------------------------- |
| `display`                        | `flex`, `none`                                      |
| `position`                       | `relative`, `absolute`                              |
| `top`, `right`, `bottom`, `left` | Length, percentage                                  |
| `overflow`                       | `visible`, `hidden` (also `overflowX`, `overflowY`) |

### Flexbox

| Property              | Values / Notes                                                                      |
| --------------------- | ----------------------------------------------------------------------------------- |
| `flexDirection`       | `row`, `column`, `row-reverse`, `column-reverse`                                    |
| `flexWrap`            | `nowrap`, `wrap`, `wrap-reverse`                                                    |
| `justifyContent`      | `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly` |
| `alignItems`          | `flex-start`, `flex-end`, `center`, `stretch`, `baseline`¹                          |
| `alignSelf`           | `auto`, `flex-start`, `flex-end`, `center`, `stretch`, `baseline`¹                  |
| `alignContent`        | `flex-start`, `flex-end`, `center`, `stretch`, `space-between`, `space-around`      |
| `flex`                | Shorthand for `flexGrow`, `flexShrink`, `flexBasis`                                 |
| `flexGrow`            | Number                                                                              |
| `flexShrink`          | Number                                                                              |
| `flexBasis`           | Length, percentage                                                                  |
| `gap`                 | Shorthand for `rowGap`, `columnGap`                                                 |
| `rowGap`, `columnGap` | Number                                                                              |

> ¹ `baseline` aligns children to the line-box **bottom** (the same result as
> `flex-end`), **not** the typographic baseline. Rows mixing different font
> sizes will not share a text baseline. This is a limitation of the bundled
> Yoga layout engine, whose JS binding exposes no baseline function; the same
> caveat applies to Satori.

### Dimensions

| Property                | Values / Notes     |
| ----------------------- | ------------------ |
| `width`, `height`       | Length, percentage |
| `minWidth`, `minHeight` | Length, percentage |
| `maxWidth`, `maxHeight` | Length, percentage |

### Spacing

| Property                                                     | Values / Notes                          |
| ------------------------------------------------------------ | --------------------------------------- |
| `margin`                                                     | Shorthand (1–4 values), supports `auto` |
| `marginTop`, `marginRight`, `marginBottom`, `marginLeft`     | Length, percentage, `auto`              |
| `padding`                                                    | Shorthand (1–4 values)                  |
| `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` | Length, percentage                      |

### Border

| Property                                                 | Values / Notes                      |
| -------------------------------------------------------- | ----------------------------------- |
| `border`                                                 | Shorthand, e.g. `"1px solid black"` |
| `borderTop`, `borderRight`, `borderBottom`, `borderLeft` | Per-side shorthand                  |
| `borderWidth`, `borderColor`, `borderStyle`              | Shorthand (1–4 values)              |
| `border{Top,Right,Bottom,Left}{Width,Color,Style}`       | Per-side longhands                  |
| `borderRadius`                                           | Shorthand (1–4 values)              |
| `border{TopLeft,TopRight,BottomRight,BottomLeft}Radius`  | Per-corner longhands                |

### Color & Background

| Property           | Values / Notes                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `color`            | Any CSS color (inherited)                                                                              |
| `backgroundColor`  | Any CSS color                                                                                          |
| `opacity`          | Number (0–1)                                                                                           |
| `background`       | Shorthand → decomposed into `backgroundColor`, `backgroundImage`, `backgroundRepeat`, `backgroundSize` |
| `backgroundImage`  | `linear-gradient()`, `radial-gradient()`, `url()`                                                      |
| `backgroundSize`   | `cover`, `contain`, length, percentage                                                                 |
| `backgroundRepeat` | `repeat` (default), `no-repeat`, `repeat-x`, `repeat-y`                                                |

### Typography

| Property                | Values / Notes                                                |
| ----------------------- | ------------------------------------------------------------- |
| `fontFamily`            | Font name (inherited)                                         |
| `fontSize`              | Number or CSS length (inherited)                              |
| `fontWeight`            | Numeric weight (inherited)                                    |
| `fontStyle`             | `normal`, `italic` (inherited)                                |
| `textAlign`             | `left`, `center`, `right`, `justify` (inherited)              |
| `textDecoration`        | String (inherited)                                            |
| `textTransform`         | `none`, `uppercase`, `lowercase`, `capitalize` (inherited)    |
| `lineHeight`            | Number or string (inherited)                                  |
| `letterSpacing`         | Number or CSS length (inherited)                              |
| `whiteSpace`            | `normal`, `nowrap`, `pre`, `pre-wrap`, `pre-line` (inherited) |
| `wordBreak`             | `normal`, `break-all`, `break-word`, `keep-all` (inherited)   |
| `textOverflow`          | `clip`, `ellipsis` (inherited)                                |
| `lineClamp`             | Number — max visible lines (adds ellipsis)                    |
| `textBox`               | Shorthand for `textBoxTrim` and `textBoxEdge`                 |
| `textBoxTrim`           | `none`, `trim-start`, `trim-end`, `trim-both` (inherited)     |
| `textBoxEdge`           | e.g. `"cap alphabetic"` (inherited)                           |
| `WebkitTextStroke`      | Shorthand, e.g. `"2px red"` (inherited)                       |
| `WebkitTextStrokeWidth` | CSS length (inherited)                                        |
| `WebkitTextStrokeColor` | Any CSS color (inherited)                                     |

### Effects

| Property          | Values / Notes                                   |
| ----------------- | ------------------------------------------------ |
| `boxShadow`       | CSS box-shadow string                            |
| `textShadow`      | CSS text-shadow string                           |
| `transform`       | `translate`, `scale`, `rotate`, `skewX`, `skewY` |
| `transformOrigin` | CSS transform-origin string                      |
| `filter`          | CSS filter string                                |

### Image

| Property    | Values / Notes                                   |
| ----------- | ------------------------------------------------ |
| `objectFit` | `contain`, `cover`, `fill`, `none`, `scale-down` |

### Units

`px`, `em`, `rem`, `%`, `vw`, `vh`, `vmin`, `vmax`, `pt`, `pc`, `in`, `cm`, `mm`

## API Overview

### `createCanvas(width, height)`

Create a new canvas. Re-exported from `@napi-rs/canvas`.

```typescript
function createCanvas(width: number, height: number): Canvas;
```

### `renderReactElement(ctx, element, options)`

Render a React element tree to a canvas context.

```typescript
async function renderReactElement(
  ctx: SKRSContext2D,
  element: ReactNode,
  options: RenderReactElementOptions,
): Promise<void>;
```

> **Image sources are not cached between calls by default.** Each call
> creates a fresh internal image cache, so every `<img>` and
> `background-image: url(...)` source in the tree is fetched and decoded
> anew. That's fine for one-shot renders, but when calling per frame in a
> loop (e.g. inside `@effing/tween`'s `tween(...)`), pass a persistent
> `options.imageCache` (`new Map()`, created outside the loop) so each
> source is loaded once, on first use. Sharing one cache across concurrent
> calls is safe — entries are load promises, so concurrent renders share a
> single in-flight fetch — and failed loads are evicted and retried.
> Alternatively, load images once up front with
> [`loadImage()`](#loadimagesource-options) and draw them with
> `ctx.drawImage(...)`, keeping the per-frame React tree to text and
> vectors — that also skips per-frame layout of the image nodes. Fonts and
> anything else fetched should likewise be resolved once, outside the loop.

```tsx
const imageCache: ImageCache = new Map();
for (let frame = 0; frame < frameCount; frame++) {
  await renderReactElement(ctx, <Frame n={frame} />, { fonts, imageCache });
}
```

### `loadImage(source, options?)`

Load an image from a path, Buffer, data URI, or remote URL. Remote `http`/`https` URLs are fetched via the global `fetch()` — the same path `<img>` sources take in `renderReactElement` — so a global dispatcher / proxy (e.g. undici's `setGlobalDispatcher`) and the `userAgent` option are honored. All other sources delegate to `@napi-rs/canvas`'s native loader.

```typescript
function loadImage(
  source: string | URL | Buffer | ArrayBufferLike | Uint8Array | Image,
  options?: LoadImageOptions, // { userAgent?: string }
): Promise<Image>;
```

```typescript
import { loadImage } from "@effing/canvas";

const image = await loadImage("https://example.com/pic.png", {
  userAgent: "my-renderer/1.0",
});
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

### `findLargestUsableFontSize(options)`

Find the largest integer font size that keeps text within the given bounds. Uses binary search with the built-in text layout engine — no external dependencies needed.

```typescript
function findLargestUsableFontSize(
  options: FindLargestUsableFontSizeOptions,
): number;
```

```typescript
import { findLargestUsableFontSize } from "@effing/canvas";

const fontSize = findLargestUsableFontSize({
  text: "Hello World",
  font,
  maxWidth: 500,
  maxHeight: 100,
  lineHeight: "normal", // optional (default: "normal")
  minFontSize: 1, // optional (default: 1)
  maxFontSize: 200, // optional (default: 1000)
});
```

### Font Helpers

- `registerFont(font)` — Register a font from a `FontData` buffer (idempotent)
- `registerFontFromPath(path, nameAlias?)` — Register a font from a file path
- `registeredFamilies()` — Get registered font family names

### Options

| Option       | Type                   | Required | Description                                                          |
| ------------ | ---------------------- | -------- | -------------------------------------------------------------------- |
| `fonts`      | `FontData[]`           | Yes      | Font data for text rendering                                         |
| `width`      | `number`               | No       | Layout width override (default: `ctx.canvas.width`)                  |
| `height`     | `number`               | No       | Layout height override (default: `ctx.canvas.height`)                |
| `debug`      | `boolean`              | No       | Draw layout bounding boxes for debugging                             |
| `emoji`      | `EmojiStyle \| "none"` | No       | Emoji style (default: `"twemoji"`)                                   |
| `userAgent`  | `string`               | No       | User-Agent header for remote image fetches                           |
| `imageCache` | `ImageCache`           | No       | Persistent image cache shared across calls (default: fresh per call) |

### Types

```typescript
type FontData = {
  name: string;
  data: Buffer | ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
};

// Keyed by source string; values are load promises, so concurrent
// renders of the same source share one in-flight fetch.
type ImageCache = Map<string, Promise<Image>>;

type EmojiStyle =
  | "twemoji"
  | "openmoji"
  | "blobmoji"
  | "noto"
  | "fluent"
  | "fluentFlat";
```

Also re-exports from `@napi-rs/canvas`: `Canvas`, `SKRSContext2D`, `GlobalFonts`, `Image`, `LottieAnimation`. (`loadImage` is wrapped — see above — not re-exported directly.)

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
