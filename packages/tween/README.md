# @effing/tween

**Easing functions and step iteration for frame-based animations.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Generate animation frames with precise timing control. Iterate over steps with progress values, apply easing functions for smooth motion.

## Installation

```bash
npm install @effing/tween
```

## Quick Start

```typescript
import { tween, easeOutQuad } from "@effing/tween";
import { pngFromSatori } from "@effing/satori";

async function* generateFrames() {
  yield* tween(90, async ({ lower: progress }) => {
    // Apply easing to progress
    const easedProgress = easeOutQuad(progress);

    // Use eased progress for animation
    const scale = 1 + 0.5 * easedProgress;
    const opacity = easedProgress;

    return pngFromSatori(
      <div style={{ transform: `scale(${scale})`, opacity }}>
        Animated!
      </div>,
      { width: 1080, height: 1920, fonts }
    );
  });
}
```

## Concepts

### Tweening

The `tween()` async generator iterates over animation frames with concurrency control. Each frame receives a `TweenInterval` with `lower` and `upper` bounds representing its position in the animation (0→1):

```typescript
import { tween } from "@effing/tween";

// Generate 60 frames with concurrent processing
yield *
  tween(60, async ({ lower, upper }, index) => {
    // lower: 0/60, 1/60, 2/60, ... 59/60
    // upper: 1/60, 2/60, 3/60, ... 60/60
    // index: 0, 1, 2, ... 59
    return renderFrame(lower);
  });
```

Frames are processed concurrently (defaulting to CPU count) but yielded in order—ideal for CPU-bound rendering work.

### Easing Functions

Transform linear progress into curved motion. All easing functions take a value in `[0, 1]` and return a value in `[0, 1]`:

```typescript
import { easeOutQuad, easeInOutCubic } from "@effing/tween";

const progress = 0.5;
easeOutQuad(progress); // 0.75 — starts fast, ends slow
easeInOutCubic(progress); // 0.5  — slow start and end
```

## API Overview

### Step Iteration

#### `steps(count)`

Returns an array of progress values from 0 to (count-1)/count:

```typescript
function steps(count: number): number[];

steps(4); // [0, 0.25, 0.5, 0.75]
```

#### `tween(count, fn, options?)`

Tween frames, with concurrency control. Yields resulting frames in order.

```typescript
async function* tween<T>(
  count: number,
  fn: (interval: TweenInterval, index: number) => Promise<T>,
  options?: { concurrency?: number }
): AsyncGenerator<T>
```

#### `tweenToArray(count, fn, options?)`

Tween frames, with concurrency control, returning an array.

```typescript
async function tweenToArray<T>(
  count: number,
  fn: (interval: TweenInterval, index: number) => Promise<T>,
  options?: { concurrency?: number },
): Promise<T[]>;
```

### Easing Functions

All easing functions have the signature `(t: number) => number`.

| Category | Functions                                             |
| -------- | ----------------------------------------------------- |
| Linear   | `linear`                                              |
| Sine     | `easeInSine`, `easeOutSine`, `easeInOutSine`          |
| Quad     | `easeInQuad`, `easeOutQuad`, `easeInOutQuad`          |
| Cubic    | `easeInCubic`, `easeOutCubic`, `easeInOutCubic`       |
| Quart    | `easeInQuart`, `easeOutQuart`, `easeInOutQuart`       |
| Quint    | `easeInQuint`, `easeOutQuint`, `easeInOutQuint`       |
| Expo     | `easeInExpo`, `easeOutExpo`, `easeInOutExpo`          |
| Circ     | `easeInCirc`, `easeOutCirc`, `easeInOutCirc`          |
| Back     | `easeInBack`, `easeOutBack`, `easeInOutBack`          |
| Elastic  | `easeInElastic`, `easeOutElastic`, `easeInOutElastic` |
| Bounce   | `easeInBounce`, `easeOutBounce`, `easeInOutBounce`    |

**Naming convention:**

- `easeIn*` — Starts slow, ends fast
- `easeOut*` — Starts fast, ends slow
- `easeInOut*` — Slow at both ends

## Examples

### Zoom Animation

```typescript
import { tween, easeOutQuad } from "@effing/tween";

yield *
  tween(90, async ({ lower: p }) => {
    const zoom = 1 + 0.3 * easeOutQuad(p);
    return renderFrame({ zoom });
  });
```

### Fade In/Out

```typescript
import { tween, easeInOutSine } from "@effing/tween";

yield *
  tween(60, async ({ lower: p }) => {
    // Fade in for first half, fade out for second half
    const opacity = p < 0.5 ? easeInOutSine(p * 2) : easeInOutSine((1 - p) * 2);
    return renderFrame({ opacity });
  });
```

### Bounce Effect

```typescript
import { tween, easeOutBounce } from "@effing/tween";

yield *
  tween(45, async ({ lower: p }) => {
    const y = 100 * (1 - easeOutBounce(p)); // Fall and bounce
    return renderFrame({ translateY: y });
  });
```

## Related Packages

- [`@effing/annie`](../annie) — Package frames into TAR archives
- [`@effing/satori`](../satori) — Render JSX to PNG for each frame
