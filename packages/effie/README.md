# @effing/effie

**Declarative video composition format for programmatic video creation.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Define video compositions with typed segments, layers, transitions, effects, and motion — then render with `@effing/ffs`.

## Installation

```bash
npm install @effing/effie
```

## Concepts

### EffieData

The root structure describing a complete video composition:

```typescript
type EffieData = {
  width: number; // Frame width in pixels
  height: number; // Frame height in pixels
  fps: number; // Frames per second
  cover: EffieWebUrl; // Cover image URL
  sources?: EffieSources; // Named source references (for reuse)
  background: EffieBackground; // Video background
  audio?: EffieAudio; // Global soundtrack
  segments: EffieSegment[]; // Consecutive video segments
};
```

### Segments & Layers

Videos are composed of **segments** (consecutive time blocks) containing **layers** (stacked visual elements):

```typescript
type EffieSegment = {
  duration: number; // Duration in seconds
  layers: EffieLayer[]; // Visual layers (bottom to top)
  background?: EffieBackground; // Override global background for this segment
  audio?: EffieAudio; // Segment-specific audio
  transition?: EffieTransition; // Transition from previous segment
};

type EffieLayer = {
  type: "image" | "animation"; // PNG/JPEG or Annie TAR
  source: EffieSource; // URL or #reference
  delay?: number; // Delay before appearing
  from?: number; // Show from this time
  until?: number; // Show until this time
  effects?: EffieEffect[]; // Visual effects (see below)
  motion?: EffieMotion; // Motion animation (see below)
};
```

### Effects vs Motion

**Effects** and **Motion** serve different purposes:

| Aspect           | Effects                                    | Motion                                      |
| ---------------- | ------------------------------------------ | ------------------------------------------- |
| **What it does** | Transforms the layer's visual appearance   | Animates the layer's position on screen     |
| **Examples**     | Fade in/out, saturation, scrolling content | Bounce, shake, slide into view              |
| **Technically**  | Pixel filters applied to the layer source  | X/Y coordinate animation during compositing |

A layer can have **multiple effects** (applied in sequence) but only **one motion** — you can fade in and saturate simultaneously, but a layer can only move in one way at a time.

### Source References

To avoid duplicating long URLs, define sources once and reference them with `#name`:

```typescript
const video = effieData({
  sources: {
    bg: "https://example.com/background.mp4",
    music: "https://example.com/audio.mp3",
  },
  background: { type: "video", source: "#bg" },
  audio: { source: "#music", volume: 0.8 },
  // ...
});
```

## Quick Start

```typescript
import { effieData, effieSegment, effieLayer } from "@effing/effie";

const video = effieData({
  width: 1080,
  height: 1920,
  fps: 30,
  cover: "https://example.com/cover.png",
  background: { type: "color", color: "#1a1a2e" },
  segments: [
    effieSegment({
      duration: 5,
      layers: [
        effieLayer({
          type: "animation",
          source: "https://example.com/intro.tar",
          effects: [{ type: "fade-in", start: 0, duration: 1 }],
        }),
      ],
    }),
    effieSegment({
      duration: 4,
      transition: { type: "slide", direction: "left", duration: 0.5 },
      layers: [
        effieLayer({ type: "image", source: "https://example.com/slide.png" }),
      ],
    }),
  ],
});
```

## API Overview

### Type Helpers

| Export              | Description                   |
| ------------------- | ----------------------------- |
| `effieData()`       | Create typed EffieData        |
| `effieSegment()`    | Create typed EffieSegment     |
| `effieLayer()`      | Create typed EffieLayer       |
| `effieBackground()` | Create typed EffieBackground  |
| `effieWebUrl()`     | Validate and cast URL strings |

### Partitioning Helpers

For distributed rendering, split compositions into segments and join them back:

| Export                  | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `effieDataForSegment()` | Extract minimal data for rendering a single segment |
| `effieDataForJoin()`    | Create data for joining pre-rendered segments       |

```typescript
import { effieDataForSegment, effieDataForJoin } from "@effing/effie";

// Split: get minimal effie data for each segment
const segmentEffie = effieDataForSegment(effieData, segmentIndex);

// After rendering segments, join them:
const joinEffie = effieDataForJoin(effieData, [
  "https://example.com/seg0.mp4",
  "https://example.com/seg1.mp4",
]);
```

### Types

| Type              | Description                            |
| ----------------- | -------------------------------------- |
| `EffieData`       | Root video composition                 |
| `EffieSegment`    | A time segment with layers             |
| `EffieLayer`      | An image or animation layer            |
| `EffieBackground` | Color, image, or video background      |
| `EffieTransition` | Transition between segments            |
| `EffieEffect`     | Layer effects (fade, saturate, scroll) |
| `EffieMotion`     | Layer motion (bounce, shake, slide)    |
| `EffieAudio`      | Audio configuration                    |
| `EffieSources`    | Named source map                       |
| `EffieSource`     | URL or #reference                      |

## Transitions

Available transition types:

| Type       | Properties             | Description        |
| ---------- | ---------------------- | ------------------ |
| `fade`     | `easing?` or `through` | Crossfade variants |
| `barn`     | `orientation`, `mode`  | Barn door wipes    |
| `circle`   | `mode`                 | Circle wipes       |
| `wipe`     | `direction`            | Wipe               |
| `slide`    | `direction`            | Slide              |
| `smooth`   | `direction`            | Smooth wipe        |
| `slice`    | `direction`            | Slice              |
| `zoom`     |                        | Zoom               |
| `dissolve` |                        | Dissolve           |
| `pixelize` |                        | Pixelate           |
| `radial`   |                        | Radial wipe        |

### Fade options

- `easing`: `"linear"` (default), `"ease-in"`, or `"ease-out"` — for direct crossfades
- `through`: `"black"`, `"white"`, or `"grays"` — fade through a color

### Circle options

- `mode`: `"open"` (default), `"close"`, or `"crop"`

### Barn door options

- `orientation`: `"horizontal"` (default) or `"vertical"`
- `mode`: `"open"` (default) or `"close"`

### Directional options (wipe, slide, smooth, slice)

- `direction`: `"left"` (default), `"right"`, `"up"`, or `"down"`

## Effects

| Type           | Properties                          | Description    |
| -------------- | ----------------------------------- | -------------- |
| `fade-in`      | `start`, `duration`                 | Fade in        |
| `fade-out`     | `start`, `duration`                 | Fade out       |
| `saturate-in`  | `start`, `duration`                 | Saturation in  |
| `saturate-out` | `start`, `duration`                 | Saturation out |
| `scroll`       | `direction`, `distance`, `duration` | Scroll layer   |

## Motion

| Type     | Properties                                    | Description     |
| -------- | --------------------------------------------- | --------------- |
| `bounce` | `amplitude`, `start`, `duration`              | Bouncing motion |
| `shake`  | `intensity`, `frequency`, `start`, `duration` | Shake effect    |
| `slide`  | `direction`, `distance`, `reverse`, `easing`  | Slide animation |

## Related Packages

- [`@effing/ffs`](../ffs) — Render Effie compositions to video
- [`@effing/effie-preview`](../effie-preview) — Preview compositions in the browser
- [`@effing/annie`](../annie) — Generate animations for layers
