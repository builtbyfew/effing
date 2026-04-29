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
  width: number; // Frame width in pixels (positive)
  height: number; // Frame height in pixels (positive)
  fps: number; // Frames per second (positive)
  cover: EffieWebUrl; // Cover image URL — direct URL only, NOT a #ref
  sources?: EffieSources; // Named source references (for reuse)
  background: EffieBackground; // All-encompassing background
  audio?: EffieAudio; // Global soundtrack
  segments: EffieSegment[]; // Consecutive video segments (rendered in order)
};
```

All required fields above must be present. `cover` is a direct URL — unlike other source-bearing fields, it does **not** accept `#ref`.

### Backgrounds

`EffieBackground` is a discriminated union with three variants:

| `type`  | Required fields  | Optional fields            |
| ------- | ---------------- | -------------------------- |
| `image` | `source`         | —                          |
| `video` | `source`         | `seek` (seconds into clip) |
| `color` | `color` (string) | —                          |

```typescript
type EffieBackground =
  | { type: "image"; source: EffieSource }
  | { type: "video"; source: EffieSource; seek?: number }
  | { type: "color"; color: string };
```

`color` accepts a CSS color name or a hex string (`RRGGBB`, `#RRGGBB`, `0xRRGGBB`, optionally with `AA` alpha). The format is **not** runtime-validated — pass strings your renderer accepts.

A segment-level `background` overrides the top-level background for that segment only.

### Audio

```typescript
type EffieAudio = {
  source: EffieSource;
  volume?: number; // [0, 1] — runtime-enforced
  fadeIn?: number; // fade-in duration in seconds
  fadeOut?: number; // fade-out duration in seconds
  seek?: number; // seek to this position in seconds
};
```

Audio can appear at the top level (global soundtrack across all segments) or per-segment (overrides the global track for that segment). `volume` is the only audio field validated at runtime — it must be in `[0, 1]`.

### Segments & Layers

Videos are composed of **segments** (consecutive time blocks) containing **layers** (stacked visual elements):

```typescript
type EffieSegment = {
  duration: number; // Duration in seconds (positive)
  layers: EffieLayer[]; // Visual layers, stacked bottom → top
  background?: EffieBackground; // Override global background for this segment
  audio?: EffieAudio; // Segment-specific audio
  transition?: EffieTransition; // Transition INTO this segment — ignored on segment 0
};

type EffieLayer = {
  type: "image" | "animation"; // PNG/JPEG or Annie TAR
  source: EffieSource; // URL or #reference
  delay?: number; // Delay before appearing (seconds, non-negative)
  from?: number; // Clip source from this time (seconds)
  until?: number; // Clip source until this time (seconds)
  effects?: EffieEffect[]; // Visual effects (see below)
  motion?: EffieMotion; // Motion animation (see below)
};
```

Layers in a segment are stacked **bottom to top**: `layers[0]` is drawn first, later entries paint over it. A segment's `transition` describes how that segment enters from the previous one; the very first segment's transition is silently ignored.

`delay`, `from`, and `until` are all in seconds, measured against the segment's timeline (`delay`) or the source's own timeline (`from`/`until`).

### Effects vs Motion

**Effects** and **Motion** serve different purposes:

| Aspect           | Effects                                    | Motion                                      |
| ---------------- | ------------------------------------------ | ------------------------------------------- |
| **What it does** | Transforms the layer's visual appearance   | Animates the layer's position on screen     |
| **Examples**     | Fade in/out, saturation, scrolling content | Bounce, shake, slide into view              |
| **Technically**  | Pixel filters applied to the layer source  | X/Y coordinate animation during compositing |

A layer can have **multiple effects** (applied in sequence) but only **one motion** — you can fade in and saturate simultaneously, but a layer can only move in one way at a time.

### Source References

To avoid duplicating long URLs, define sources once in the top-level `sources` map and reference them as `#name` from any `source: EffieSource` field — segment/global backgrounds, segment/global audio, and any layer:

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

The top-level `cover` field is the one exception: it must be a direct `EffieWebUrl` and does **not** accept `#ref`. Every `#name` used elsewhere must resolve to a key in `sources` — this is enforced at runtime by the schema.

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

## Validation

`@effing/effie` ships two complementary checking layers:

- **Type checking** — `effieData()`, `effieSegment()`, `effieLayer()`, and `effieBackground()` are **identity functions at runtime**; they exist purely to give TypeScript better inference (especially for `#ref` literal types). Calling them does **not** perform any structural validation.
- **Runtime validation** — import the zod schemas from `@effing/effie` (zod is an optional peer dependency) and call `safeParse`:

```typescript
import { effieDataSchema } from "@effing/effie";

const result = effieDataSchema.safeParse(unknownInput);
if (!result.success) {
  console.error(result.error.issues);
} else {
  const data = result.data; // typed EffieData
}
```

Schemas are also exported per shape (`effieSegmentSchema`, `effieLayerSchema`, `effieBackgroundSchema`, `effieAudioSchema`, `effieTransitionSchema`, `effieEffectSchema`, `effieMotionSchema`) and as factories (`createEffieDataSchema(urlSchema)`) when you need to extend the URL universe — `effieDataWithFilesSchema` is one such variant that also accepts `file:` URLs for trusted operations.

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

All motion variants share optional `start` and `duration` (in seconds). Variant-specific fields:

| Type     | Required    | Optional                        | Description     |
| -------- | ----------- | ------------------------------- | --------------- |
| `bounce` | —           | `amplitude`                     | Bouncing motion |
| `shake`  | —           | `intensity`, `frequency`        | Shake effect    |
| `slide`  | `direction` | `distance`, `reverse`, `easing` | Slide animation |

`direction` is required for `slide` only; `bounce` and `shake` need no required fields beyond `type`.

## Runtime Constraints

### Enforced by `effieDataSchema`

The schema rejects the following at parse time:

- **Volume** — `audio.volume` must be in `[0, 1]`.
- **Source references** — every `#name` in a `source` field must resolve to a key in the top-level `sources` map.
- **Transition fits both segments** — for any segment _i_ ≥ 1 with a `transition`, both `segments[i].duration` and `segments[i - 1].duration` must be ≥ `transition.duration`.
- **URL shape** — sources must be HTTP/HTTPS or `data:` URLs (plus `file:` if you use `effieDataWithFilesSchema`); the cover must be a web URL.
- **Strict objects** — unknown keys are rejected on every shape.

### NOT enforced — write defensively

The format does not currently validate these. Producers should ensure them themselves; renderers may misbehave or silently truncate otherwise:

- **Positive dimensions/fps** — `width`, `height`, `fps` must be positive (not checked).
- **Non-negative `delay`** — layer `delay` should be `≥ 0`.
- **Layer clip ordering** — `from < until`, both within the source media's actual length.
- **Effect timing within layer's effective duration** — `effect.start` and `effect.start + effect.duration` should fall inside the window the layer is on screen (segment duration, minus `delay`, minus any clipping).
- **Motion timing** — same caveat for `motion.start` / `motion.duration`.
- **Transition duration on segment 0** — accepted by the schema but ignored at render time.
- **Color string format** — any string is accepted; it's the renderer's job to parse it.

If something is uncertain, assert it in your producer or extend the schema — the format does not catch these for you.

## Related Packages

- [`@effing/ffs`](../ffs) — Render Effie compositions to video
- [`@effing/effie-preview`](../effie-preview) — Preview compositions in the browser
- [`@effing/annie`](../annie) — Generate animations for layers
