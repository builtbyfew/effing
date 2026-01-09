# @effing/satori

**Render JSX to PNG using Satori, with emoji support.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

A thin wrapper around [Satori](https://github.com/vercel/satori) that renders JSX to PNG buffers. Includes built-in emoji support with multiple emoji styles.

## Installation

```bash
npm install @effing/satori
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

## API Overview

### `pngFromSatori(template, options)`

Render a JSX template to a PNG buffer.

```typescript
function pngFromSatori(
  template: React.ReactNode,
  options: PngFromSatoriOptions,
): Promise<Buffer>;
```

**Options:**

| Option   | Type         | Required | Description                        |
| -------- | ------------ | -------- | ---------------------------------- |
| `width`  | `number`     | Yes      | Output width in pixels             |
| `height` | `number`     | Yes      | Output height in pixels            |
| `fonts`  | `FontData[]` | Yes      | Font data for text rendering       |
| `emoji`  | `EmojiStyle` | No       | Emoji style (default: `"twemoji"`) |

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
