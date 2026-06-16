# @effing/annie-player

**Browser player for Annie animations.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Play TAR archives of PNG or JPEG frames in the browser using canvas. Framework-agnostic core with optional React component.

## Installation

```bash
npm install @effing/annie-player
```

## Quick Start

### React

```tsx
import { AnniePlayer } from "@effing/annie-player/react";

function App() {
  return (
    <AnniePlayer
      src="https://example.com/animation.tar"
      height={540}
      autoLoad
      autoPlay
      fps={30}
    />
  );
}
```

The React component includes built-in inline styles for:

- Wrapper positioning
- Load/Play/Pause buttons with hover states
- Status overlay
- Canvas styling

To customize the root container, use `className` and `style` props:

```tsx
<AnniePlayer
  src="https://example.com/animation.tar"
  height={540}
  className="my-player"
  style={{ border: "2px solid blue" }}
/>
```

#### Compound Components

For full control over styling and layout, use compound components:

```tsx
import { AnniePlayer } from "@effing/annie-player/react";

function CustomPlayer() {
  return (
    <AnniePlayer.Root
      src="https://example.com/animation.tar"
      height={540}
      autoLoad
      autoPlay
    >
      <AnniePlayer.Wrapper style={{ border: "2px solid blue" }}>
        <AnniePlayer.Canvas style={{ backgroundColor: "#000" }} />
        <AnniePlayer.Controls
          style={{ position: "absolute", bottom: 16, top: "auto" }}
        >
          <AnniePlayer.LoadButton />
          <AnniePlayer.PlayButton />
          <AnniePlayer.PauseButton />
        </AnniePlayer.Controls>
        <AnniePlayer.Status />
      </AnniePlayer.Wrapper>
    </AnniePlayer.Root>
  );
}
```

#### Headless (Render Function)

For maximum control, use the render function pattern:

```tsx
import { AnniePlayer } from "@effing/annie-player/react";

function HeadlessPlayer() {
  return (
    <AnniePlayer.Root src="https://example.com/animation.tar" height={540}>
      {({ state, actions, canvasRef, canvasDimensions }) => (
        <div className="my-custom-player">
          <canvas
            ref={canvasRef}
            width={canvasDimensions.width}
            height={canvasDimensions.height}
          />
          <div className="my-controls">
            <button onClick={actions.load} disabled={state.isLoading}>
              {state.isLoading ? "Loading..." : "Load"}
            </button>
            <button
              onClick={actions.play}
              disabled={!state.frameCount || state.isPlaying}
            >
              Play
            </button>
            <button onClick={actions.pause} disabled={!state.isPlaying}>
              Pause
            </button>
          </div>
          <p className="my-status">{state.status}</p>
          {state.error && <p className="my-error">Error: {state.error}</p>}
        </div>
      )}
    </AnniePlayer.Root>
  );
}
```

#### Available Sub-components

| Component                  | Description                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AnniePlayer.Root`         | Provider that manages player state. Accepts `src`, `height`, `defaultWidth`, `fps`, `autoLoad`, `autoPlay`. |
| `AnniePlayer.Wrapper`      | Container with hover detection. Sets `data-hovering` and `data-playing` attributes.                         |
| `AnniePlayer.Canvas`       | The canvas element where frames are rendered.                                                               |
| `AnniePlayer.Controls`     | Container for buttons. Auto-hides when playing (unless hovering).                                           |
| `AnniePlayer.LoadButton`   | Load button with default "Load"/"Loading..." text.                                                          |
| `AnniePlayer.PlayButton`   | Play button with default "Play" text.                                                                       |
| `AnniePlayer.PauseButton`  | Pause button with default "Pause" text.                                                                     |
| `AnniePlayer.Scrubber`     | Range slider that seeks through frames. Accepts `pauseWhileScrubbing`.                                      |
| `AnniePlayer.FrameCounter` | Shows `current / total` frame. Accepts a render-prop child `(frame) => ReactNode`.                          |
| `AnniePlayer.Status`       | Status overlay showing current state.                                                                       |

### Vanilla JavaScript

```typescript
import { AnniePlayerCore } from "@effing/annie-player";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const player = new AnniePlayerCore({
  src: "https://example.com/animation.tar",
  fps: 30,
  autoPlay: true,
});

player.attachCanvas(canvas);
player.on("load", ({ frameCount, dimensions }) => {
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
});

await player.load();
```

## API Overview

### AnniePlayerCore

```typescript
class AnniePlayerCore {
  constructor(options: AnniePlayerOptions);

  // Canvas management
  attachCanvas(canvas: HTMLCanvasElement): void;
  detachCanvas(): void;

  // Lifecycle
  load(): Promise<void>;
  destroy(): void;

  // Playback
  play(): void;
  pause(): void;
  stop(): void;
  seek(frameIndex: number): void;

  // State
  getState(): AnniePlayerState;

  // Events
  on<K extends keyof AnniePlayerEvents>(
    event: K,
    callback: (data: AnniePlayerEvents[K]) => void,
  ): () => void;
}
```

**Options:**

| Option     | Type      | Default  | Description              |
| ---------- | --------- | -------- | ------------------------ |
| `src`      | `string`  | required | URL to TAR archive       |
| `fps`      | `number`  | `30`     | Playback frame rate      |
| `autoPlay` | `boolean` | `false`  | Start playing after load |

**State:**

```typescript
type AnniePlayerState = {
  status: string;
  error: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  frameCount: number;
  currentFrame: number;
  dimensions: { width: number; height: number } | null;
};
```

**Events:**

| Event         | Data                         | Description    |
| ------------- | ---------------------------- | -------------- |
| `statechange` | `AnniePlayerState`           | State updated  |
| `load`        | `{ frameCount, dimensions }` | Frames loaded  |
| `error`       | `Error`                      | Error occurred |

### AnniePlayer (React)

```tsx
<AnniePlayer
  src={string} // TAR archive URL
  height={number} // Canvas height
  defaultWidth={number} // Width before load (default: same as height)
  autoLoad={boolean} // Load on mount (default: false)
  autoPlay={boolean} // Play after load (default: false)
  fps={number} // Frame rate (default: 30)
  className={string} // Class name for root container
  style={CSSProperties} // Style for root container
/>
```

The React component:

- Manages core lifecycle automatically
- Adjusts canvas width based on loaded frame aspect ratio
- Shows load/play/pause buttons with built-in styling
- Displays status overlay on hover

## Examples

### Custom Controls

```typescript
const player = new AnniePlayerCore({ src, fps: 30 });
player.attachCanvas(canvas);

loadButton.onclick = () => player.load();
playButton.onclick = () => player.play();
pauseButton.onclick = () => player.pause();

player.on("statechange", (state) => {
  playButton.disabled = state.isPlaying || state.frameCount === 0;
  pauseButton.disabled = !state.isPlaying;
  statusText.textContent = state.status;
});
```

## Related Packages

- [`@effing/annie`](../annie) — Generate Annie animations server-side
- [`@effing/effie-preview`](../effie-preview) — Preview components that use AnniePlayer
