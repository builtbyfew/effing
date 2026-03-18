# @effing/effie-preview

## 0.23.1

### Patch Changes

- @effing/effie@0.23.1
- @effing/annie-player@0.23.1

## 0.23.0

### Patch Changes

- @effing/effie@0.23.0
- @effing/annie-player@0.23.0

## 0.22.3

### Patch Changes

- @effing/effie@0.22.3
- @effing/annie-player@0.22.3

## 0.22.2

### Patch Changes

- @effing/effie@0.22.2
- @effing/annie-player@0.22.2

## 0.22.1

### Patch Changes

- @effing/effie@0.22.1
- @effing/annie-player@0.22.1

## 0.22.0

### Patch Changes

- @effing/effie@0.22.0
- @effing/annie-player@0.22.0

## 0.21.1

### Patch Changes

- @effing/effie@0.21.1
- @effing/annie-player@0.21.1

## 0.21.0

### Patch Changes

- @effing/effie@0.21.0
- @effing/annie-player@0.21.0

## 0.20.1

### Patch Changes

- @effing/effie@0.20.1
- @effing/annie-player@0.20.1

## 0.20.0

### Patch Changes

- @effing/effie@0.20.0
- @effing/annie-player@0.20.0

## 0.19.3

### Patch Changes

- @effing/effie@0.19.3
- @effing/annie-player@0.19.3

## 0.19.2

### Patch Changes

- @effing/effie@0.19.2
- @effing/annie-player@0.19.2

## 0.19.1

### Patch Changes

- @effing/effie@0.19.1
- @effing/annie-player@0.19.1

## 0.19.0

### Patch Changes

- @effing/effie@0.19.0
- @effing/annie-player@0.19.0

## 0.18.6

### Patch Changes

- @effing/effie@0.18.6
- @effing/annie-player@0.18.6

## 0.18.5

### Patch Changes

- @effing/effie@0.18.5
- @effing/annie-player@0.18.5

## 0.18.4

### Patch Changes

- @effing/effie@0.18.4
- @effing/annie-player@0.18.4

## 0.18.3

### Patch Changes

- @effing/effie@0.18.3
- @effing/annie-player@0.18.3

## 0.18.2

### Patch Changes

- @effing/effie@0.18.2
- @effing/annie-player@0.18.2

## 0.18.1

### Patch Changes

- @effing/effie@0.18.1
- @effing/annie-player@0.18.1

## 0.18.0

### Patch Changes

- @effing/effie@0.18.0
- @effing/annie-player@0.18.0

## 0.17.1

### Patch Changes

- @effing/effie@0.17.1
- @effing/annie-player@0.17.1

## 0.17.0

### Patch Changes

- @effing/effie@0.17.0
- @effing/annie-player@0.17.0

## 0.16.0

### Patch Changes

- @effing/effie@0.16.0
- @effing/annie-player@0.16.0

## 0.15.1

### Patch Changes

- @effing/effie@0.15.1
- @effing/annie-player@0.15.1

## 0.15.0

### Minor Changes

- adf62db: Expose downloaded video blob via `onFullyBuffered` callback. `useVideoStream` now collects all streamed chunks into a `blobRef` and `EffieVideoPreview`/`EffieCoverPreview` pass the `Blob` to `onFullyBuffered(blob)`, enabling consumers to create a download link without re-fetching.

### Patch Changes

- @effing/effie@0.15.0
- @effing/annie-player@0.15.0

## 0.14.1

### Patch Changes

- @effing/effie@0.14.1
- @effing/annie-player@0.14.1

## 0.14.0

### Minor Changes

- 8225851: Extract standalone `EffieVideoPreview` component for MSE video playback, simplify `EffieCoverPreview` to use it internally

### Patch Changes

- @effing/effie@0.14.0
- @effing/annie-player@0.14.0

## 0.13.1

### Patch Changes

- @effing/effie@0.13.1
- @effing/annie-player@0.13.1

## 0.13.0

### Patch Changes

- @effing/effie@0.13.0
- @effing/annie-player@0.13.0

## 0.12.0

### Patch Changes

- @effing/effie@0.12.0
- @effing/annie-player@0.12.0

## 0.11.2

### Patch Changes

- @effing/effie@0.11.2
- @effing/annie-player@0.11.2

## 0.11.1

### Patch Changes

- @effing/effie@0.11.1
- @effing/annie-player@0.11.1

## 0.11.0

### Patch Changes

- @effing/effie@0.11.0
- @effing/annie-player@0.11.0

## 0.10.5

### Patch Changes

- @effing/effie@0.10.5
- @effing/annie-player@0.10.5

## 0.10.4

### Patch Changes

- @effing/effie@0.10.4
- @effing/annie-player@0.10.4

## 0.10.3

### Patch Changes

- @effing/effie@0.10.3
- @effing/annie-player@0.10.3

## 0.10.2

### Patch Changes

- @effing/effie@0.10.2
- @effing/annie-player@0.10.2

## 0.10.1

### Patch Changes

- @effing/effie@0.10.1
- @effing/annie-player@0.10.1

## 0.10.0

### Patch Changes

- @effing/effie@0.10.0
- @effing/annie-player@0.10.0

## 0.9.0

### Patch Changes

- @effing/effie@0.9.0
- @effing/annie-player@0.9.0

## 0.8.0

### Minor Changes

- 3008ef2: Consolidate SSE event types to reduce stringly-typed event drift

  Export `WarmupEventMap`, `RenderEventMap`, and typed sender utilities from a new `@effing/ffs/sse` entrypoint. Replace the untyped `SSEEventSender` with a generic `TypedEventSender<TMap>` so `createEventSender` and `prefixEventSender` enforce correct payloads per event name at compile time. A plain `EventSender` remains for wire boundaries like `proxyRemoteSSE`.

  On the client in `@effing/effie-preview`, derive `EffieWarmupEvent` from `WarmupEventMap` via a mapped type and normalise all variants to `{ type, data }` so the client union stays in sync with the server automatically.

### Patch Changes

- @effing/effie@0.8.0
- @effing/annie-player@0.8.0

## 0.7.3

### Patch Changes

- @effing/effie@0.7.3
- @effing/annie-player@0.7.3

## 0.7.2

### Patch Changes

- @effing/effie@0.7.2
- @effing/annie-player@0.7.2

## 0.7.1

### Patch Changes

- @effing/effie@0.7.1
- @effing/annie-player@0.7.1

## 0.7.0

### Patch Changes

- @effing/effie@0.7.0
- @effing/annie-player@0.7.0

## 0.6.1

### Patch Changes

- cab03d7: Add a service worker to the starter demo that caches FFS render responses, preventing re-fetch failures when the browser revisits one-time-consumption render URLs. Also add `crossOrigin="anonymous"` to the `EffieCoverPreview` video element.
  - @effing/effie@0.6.1
  - @effing/annie-player@0.6.1

## 0.6.0

### Patch Changes

- @effing/effie@0.6.0
- @effing/annie-player@0.6.0

## 0.5.0

### Patch Changes

- @effing/effie@0.5.0
- @effing/annie-player@0.5.0

## 0.4.1

### Patch Changes

- @effing/effie@0.4.1
- @effing/annie-player@0.4.1

## 0.4.0

### Patch Changes

- @effing/effie@0.4.0
- @effing/annie-player@0.4.0

## 0.3.0

### Patch Changes

- @effing/effie@0.3.0
- @effing/annie-player@0.3.0

## 0.2.0

### Patch Changes

- 60ed654: Fix background video/image preview to use cover mode

  Background videos and images in `EffieBackgroundPreviewMedia` now default to `objectFit: "cover"` to match the actual render behavior, preventing letterboxing in the preview.

- Updated dependencies [e67c47a]
  - @effing/effie@0.2.0
  - @effing/annie-player@0.2.0

## 0.1.2

### Patch Changes

- @effing/effie@0.1.2
- @effing/annie-player@0.1.2

## 0.1.1

### Patch Changes

- @effing/effie@0.1.1
- @effing/annie-player@0.1.1
