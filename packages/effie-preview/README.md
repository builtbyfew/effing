# @effing/effie-preview

**Preview components for Effie video compositions.**

> Part of the [**Effing**](../../README.md) family — programmatic video creation with TypeScript.

Preview covers, backgrounds, layers, and segments before rendering. Uses `@effing/annie-player` for animation playback.

## Installation

```bash
npm install @effing/effie-preview @effing/effie @effing/annie-player
```

## Quick Start

### React

React components are available in `@effing/effie-preview/react`.

#### Simple API (built-in styles)

```tsx
import { createEffieSourceResolver } from "@effing/effie-preview";
import {
  EffieCoverPreview,
  EffieBackgroundPreview,
  EffieSegmentPreview,
} from "@effing/effie-preview/react";

function EffiePreview({ effieJson, renderedVideoUrl }) {
  const resolveSource = createEffieSourceResolver(effieJson.sources);

  return (
    <div>
      <h2>Cover</h2>
      <EffieCoverPreview cover={effieJson.cover} video={renderedVideoUrl} />

      <h2>Background</h2>
      <EffieBackgroundPreview
        background={effieJson.background}
        resolveSource={resolveSource}
      />

      <h2>Segments</h2>
      {effieJson.segments.map((segment, i) => (
        <EffieSegmentPreview
          key={i}
          segment={segment}
          index={i}
          resolveSource={resolveSource}
        />
      ))}
    </div>
  );
}
```

#### Compound API (full control)

For custom layouts, use the compound sub-components:

```tsx
import {
  EffieBackgroundPreview,
  EffieSegmentPreview,
  EffieLayerPreview,
} from "@effing/effie-preview/react";

function CustomLayout({ effieJson }) {
  const resolveSource = createEffieSourceResolver(effieJson.sources);

  return (
    <div>
      {/* Background with custom layout */}
      <EffieBackgroundPreview.Root style={{ display: "grid", gap: "2rem" }}>
        <EffieBackgroundPreview.Media
          background={effieJson.background}
          resolveSource={resolveSource}
          style={{ height: 300, objectFit: "cover" }}
        />
        <EffieBackgroundPreview.Info
          background={effieJson.background}
          style={{ fontSize: "0.9rem" }}
        />
      </EffieBackgroundPreview.Root>

      {/* Segments with custom layer layout */}
      {effieJson.segments.map((segment, i) => (
        <EffieSegmentPreview.Root key={i} style={{ padding: "2rem" }}>
          <EffieSegmentPreview.Header style={{ fontWeight: 700 }}>
            Segment {i + 1} — {segment.duration}s
          </EffieSegmentPreview.Header>
          <EffieSegmentPreview.Layers
            style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)" }}
          >
            {segment.layers.map((layer, j) => (
              <EffieLayerPreview.Root key={j}>
                <EffieLayerPreview.Media
                  layer={layer}
                  index={j}
                  resolveSource={resolveSource}
                  resolution={{ width: 356, height: 200 }}
                />
                <EffieLayerPreview.Info layer={layer} index={j} />
              </EffieLayerPreview.Root>
            ))}
          </EffieSegmentPreview.Layers>
        </EffieSegmentPreview.Root>
      ))}
    </div>
  );
}
```

## Concepts

### Source Resolution

Effie compositions can reference sources by name (`#mySource`) instead of full URLs. The preview components use a source resolver to look up these references:

```typescript
import { createEffieSourceResolver } from "@effing/effie-preview";

const resolve = createEffieSourceResolver(effieJson.sources);
resolve("#background"); // Returns the actual URL
resolve("https://..."); // Returns as-is
```

## API Overview

### Core

#### `createEffieSourceResolver(sources?)`

Create a function that resolves source references:

```typescript
function createEffieSourceResolver(sources?: EffieSources): EffieSourceResolver;

type EffieSourceResolver = (src: string) => string;
```

### React Components

All preview components support both simple and compound usage patterns.

#### `EffieCoverPreview`

Display the cover image, or a video player if a rendered video is available.

```tsx
<EffieCoverPreview
  cover={EffieWebUrl}         // Cover image URL
  resolution={{ width, height }} // Preview resolution
  video={string | null}       // Optional rendered video URL
  onPlay={() => void}         // Callback when video starts playing
  onFullyBuffered={() => void} // Callback when video is fully buffered
  className={string}          // Class name for img/video element
  style={CSSProperties}       // Style for img/video element
/>
```

#### `EffieBackgroundPreview`

Preview the composition background (color, image, or video).

**Simple:**

```tsx
<EffieBackgroundPreview
  background={EffieBackground}
  resolveSource={EffieSourceResolver}
  resolution={{ width, height }}
  className={string}
  style={CSSProperties}
/>
```

**Compound:**

```tsx
<EffieBackgroundPreview.Root className={string} style={CSSProperties}>
  <EffieBackgroundPreview.Media
    background={EffieBackground}
    resolveSource={EffieSourceResolver}
    className={string}
    style={CSSProperties}
  />
  <EffieBackgroundPreview.Info
    background={EffieBackground}
    className={string}
    style={CSSProperties}
  />
</EffieBackgroundPreview.Root>
```

#### `EffieSegmentPreview`

Preview a segment with all its layers. The `stacking` prop controls how layers are arranged:

- `"vertical"` (default): layers stack vertically, info beside each layer
- `"horizontal"`: layers flow horizontally, info below each layer

**Simple:**

```tsx
<EffieSegmentPreview
  segment={EffieSegment}
  index={number}
  resolveSource={EffieSourceResolver}
  resolution={{ width, height }}
  stacking={"vertical" | "horizontal"} // Default: "vertical"
  className={string}
  style={CSSProperties}
/>
```

**Compound:**

```tsx
<EffieSegmentPreview.Root className={string} style={CSSProperties}>
  <EffieSegmentPreview.Header className={string} style={CSSProperties}>
    {children}
  </EffieSegmentPreview.Header>
  <EffieSegmentPreview.Layers className={string} style={CSSProperties}>
    {children}
  </EffieSegmentPreview.Layers>
</EffieSegmentPreview.Root>
```

#### `EffieLayerPreview`

Preview a single layer (image or animation). The `stacking` prop controls layout:

- `"horizontal"` (default): info beside media (flex row)
- `"vertical"`: info below media (flex column)

**Simple:**

```tsx
<EffieLayerPreview
  layer={EffieLayer}
  index={number}
  resolveSource={EffieSourceResolver}
  resolution={{ width, height }}
  stacking={"vertical" | "horizontal"} // Default: "horizontal"
  className={string}
  style={CSSProperties}
/>
```

**Compound:**

```tsx
<EffieLayerPreview.Root className={string} style={CSSProperties}>
  <EffieLayerPreview.Media
    layer={EffieLayer}
    index={number}
    resolveSource={EffieSourceResolver}
    resolution={{ width, height }}
    className={string}
    style={CSSProperties}
  />
  <EffieLayerPreview.Info
    layer={EffieLayer}
    index={number}
    className={string}
    style={CSSProperties}
  />
</EffieLayerPreview.Root>
```

For animation layers, `EffieLayerPreview.Media` renders an `AnniePlayer` with load/play controls.

### Validation Errors

#### `parseEffieValidationIssues(issues)`

Parse validation issues from an error response:

```typescript
import { parseEffieValidationIssues } from "@effing/effie-preview";

const response = await fetch("ffs.example.com/render", {
  method: "POST",
  body,
});
if (!response.ok) {
  const errorBody = await response.json();
  const issues = parseEffieValidationIssues(errorBody.issues);
  // issues: EffieValidationIssue[] | undefined
}
```

#### `EffieValidationErrors`

Display validation errors with detailed issue breakdown:

```tsx
import { EffieValidationErrors } from "@effing/effie-preview/react";

<EffieValidationErrors
  error={string}                    // Error message (e.g., "Invalid effie data")
  issues={EffieValidationIssue[]}   // Optional list of validation issues
  className={string}
  style={CSSProperties}
/>
```

Each `EffieValidationIssue` contains:

- `path` — Path to the field that failed validation (e.g., `"segments.0.transition.sweep"`)
- `message` — Human-readable error message

## Related Packages

- [`@effing/effie`](../effie) — Video composition types
- [`@effing/annie-player`](../annie-player) — Animation playback (used internally)
