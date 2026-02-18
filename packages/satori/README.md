# @effing/satori

**Render JSX to PNG using Satori, with emoji support.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

A thin wrapper around [Satori](https://github.com/vercel/satori) that renders JSX to PNG buffers. Includes built-in emoji support with multiple emoji styles, standalone SVG/rasterization functions, and an optional worker pool for parallelized rendering.

## Installation

```bash
npm install @effing/satori
```

For worker pool support (optional):

```bash
npm install @effing/satori react
```

## Quick Start

```typescript
import { pngFromSatori, type FontData } from "@effing/satori";

// Load fonts
const interFont: FontData = {
  name: "Inter",
  data: await fs.readFile("./fonts/Inter-Regular.ttf"),
  weight: 400,
  style: "normal"
};

// Render JSX to PNG
const png = await pngFromSatori(
  <div style={{
    width: 1080,
    height: 1920,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a2e",
    color: "white",
    fontSize: 64,
  }}>
    Hello World! 🚀
  </div>,
  {
    width: 1080,
    height: 1920,
    fonts: [interFont],
    emoji: "twemoji"
  }
);

// png is a Buffer containing the PNG image
await fs.writeFile("output.png", png);
```

## Concepts

### Rendering Pipeline

```
JSX → Satori → SVG → Resvg → PNG Buffer
```

1. **Satori** converts JSX with CSS-like styles to SVG
2. **Resvg** renders the SVG to a PNG buffer

The pipeline is also available as standalone functions (`svgFromSatori` and `rasterizeSvg`) for cases where you need the intermediate SVG or want to rasterize SVGs from other sources.

### Font Loading

Satori requires font data to render text. You must provide fonts as ArrayBuffers:

```typescript
const fonts: FontData[] = [
  {
    name: "Inter",
    data: fontBuffer,
    weight: 400,
    style: "normal",
  },
];
```

### Emoji Support

The package automatically loads emoji SVGs from CDNs. Supported styles:

| Style        | Source                         |
| ------------ | ------------------------------ |
| `twemoji`    | Twitter Emoji (default)        |
| `openmoji`   | OpenMoji                       |
| `blobmoji`   | Google Blob Emoji              |
| `noto`       | Google Noto Emoji              |
| `fluent`     | Microsoft Fluent Emoji (color) |
| `fluentFlat` | Microsoft Fluent Emoji (flat)  |

### Worker Pool

When rendering many frames (e.g. for animations), you can parallelize rendering across CPU cores using the worker pool. This can provide up to 5x speedups depending on render complexity.

The pool handles React element serialization automatically — you pass JSX in and get PNG/SVG buffers out, just like the single-threaded API.

```typescript
import { createSatoriPool } from "@effing/satori/pool";

const pool = createSatoriPool({ maxThreads: 4 });

const png = await pool.renderToPng(
  <div style={{ fontSize: 48 }}>Hello from a worker!</div>,
  { width: 800, height: 600, fonts }
);

// Clean up when done
await pool.destroy();
```

**Peer dependencies:** The pool and serde sub-paths require `react` to be installed. It is listed as an optional peer dependency so the main `@effing/satori` entry works without it.

### Vite Plugin (SSR)

**The `@effing/satori/vite` plugin is required when using the worker pool in production SSR builds.** Without it, the worker file path breaks after Vite bundles the pool code, because `import.meta.url` points at the build output directory instead of `node_modules`.

The plugin bundles the worker into a self-contained file in the SSR output and rewrites `createSatoriPool()` calls to point at it.

```typescript
// vite.config.ts
import { satoriPoolPlugin } from "@effing/satori/vite";

export default defineConfig({
  plugins: [satoriPoolPlugin()],
});
```

In dev mode the plugin is inert — `import.meta.url` still resolves into `node_modules` correctly, so no rewriting is needed.

## API Overview

### `pngFromSatori(template, options)`

Render a JSX template to a PNG buffer.

```typescript
function pngFromSatori(
  template: React.ReactNode,
  options: SatoriOptions,
): Promise<Buffer>;
```

### `svgFromSatori(template, options)`

Render a JSX template to an SVG string.

```typescript
function svgFromSatori(
  template: React.ReactNode,
  options: SatoriOptions,
): Promise<string>;
```

### `rasterizeSvg(svg)`

Rasterize an SVG string to a PNG buffer using Resvg.

```typescript
function rasterizeSvg(svg: string): Buffer;
```

### Options

| Option   | Type         | Required | Description                        |
| -------- | ------------ | -------- | ---------------------------------- |
| `width`  | `number`     | Yes      | Output width in pixels             |
| `height` | `number`     | Yes      | Output height in pixels            |
| `fonts`  | `FontData[]` | Yes      | Font data for text rendering       |
| `emoji`  | `EmojiStyle` | No       | Emoji style (default: `"twemoji"`) |

### `@effing/satori/pool`

#### `createSatoriPool(options?)`

Create a worker pool for parallelized rendering.

```typescript
function createSatoriPool(options?: SatoriPoolOptions): SatoriPool;
```

**Pool options:**

| Option       | Type     | Default            | Description            |
| ------------ | -------- | ------------------ | ---------------------- |
| `minThreads` | `number` | `1`                | Minimum worker threads |
| `maxThreads` | `number` | `os.cpus().length` | Maximum worker threads |

**`SatoriPool` methods:**

- `renderToPng(element, options)` — Render JSX to PNG buffer
- `renderToSvg(element, options)` — Render JSX to SVG string
- `rasterizeSvgToPng(svg, options?)` — Rasterize SVG to PNG buffer
- `destroy()` — Shut down the pool

### `@effing/satori/vite`

#### `satoriPoolPlugin()`

Vite plugin that bundles the satori worker into the SSR output. Required for production SSR builds using the worker pool.

```typescript
function satoriPoolPlugin(): Plugin;
```

### `@effing/satori/serde`

React element serialization for cross-thread communication. Used internally by the pool, but available for custom worker setups.

- `expandElement(node)` — Recursively flatten function components to intrinsic elements
- `serializeElement(node)` — Make a React element tree structured-clone-safe
- `deserializeElement(data)` — Reconstruct React elements from serialized data

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

## Examples

### Frame Generation for Animations

```typescript
import { pngFromSatori } from "@effing/satori";
import { tween, easeOutQuad } from "@effing/tween";
import { annieStream } from "@effing/annie";

async function* generateFrames() {
  yield* tween(90, async ({ lower: progress }) => {
    const scale = 1 + 0.3 * easeOutQuad(progress);

    return pngFromSatori(
      <div style={{
        width: 1080,
        height: 1920,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale})`,
        fontSize: 72,
        color: "white",
      }}>
        ✨ Animated! ✨
      </div>,
      { width: 1080, height: 1920, fonts }
    );
  });
}

const stream = annieStream(generateFrames());
```

### Pool-Based Frame Generation

For animation workloads with many frames, the worker pool provides significant speedups:

```typescript
import { createSatoriPool } from "@effing/satori/pool";
import { annieStream } from "@effing/annie";

const pool = createSatoriPool();

async function* generateFrames() {
  const frames = Array.from({ length: 90 }, (_, i) => i / 89);

  const results = await Promise.all(
    frames.map((progress) =>
      pool.renderToPng(
        <div style={{
          width: 1080,
          height: 1920,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${1 + 0.3 * progress})`,
          fontSize: 72,
          color: "white",
        }}>
          ✨ Animated! ✨
        </div>,
        { width: 1080, height: 1920, fonts }
      )
    )
  );

  for (const frame of results) yield frame;
}

const stream = annieStream(generateFrames());
await pool.destroy();
```

### Multiple Font Weights

```typescript
const fonts: FontData[] = [
  {
    name: "Inter",
    data: await fs.readFile("./Inter-Regular.ttf"),
    weight: 400,
    style: "normal"
  },
  {
    name: "Inter",
    data: await fs.readFile("./Inter-Bold.ttf"),
    weight: 700,
    style: "normal"
  }
];

const png = await pngFromSatori(
  <div style={{ display: "flex", flexDirection: "column" }}>
    <span style={{ fontWeight: 400 }}>Regular text</span>
    <span style={{ fontWeight: 700 }}>Bold text</span>
  </div>,
  { width: 800, height: 600, fonts }
);
```

## Related Packages

- [`@effing/tween`](../tween) — Step iteration for frame generation
- [`@effing/annie`](../annie) — Package rendered frames into animations
