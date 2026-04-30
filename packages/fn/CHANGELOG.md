# @effing/fn

## 0.31.1

### Patch Changes

- @effing/annie@0.31.1

## 0.31.0

### Patch Changes

- @effing/annie@0.31.0

## 0.30.2

### Patch Changes

- @effing/annie@0.30.2

## 0.30.1

### Patch Changes

- @effing/annie@0.30.1

## 0.30.0

### Patch Changes

- @effing/annie@0.30.0

## 0.29.1

### Patch Changes

- Updated dependencies [8825191]
  - @effing/annie@0.29.1

## 0.29.0

### Patch Changes

- @effing/annie@0.29.0

## 0.28.0

### Minor Changes

- 9d773d6: Move response helpers to @effing/fn and restructure starter template using @effing/fn

  `annieResponse` and `AnnieResponseOptions` have moved from `@effing/annie` to `@effing/fn`.
  `effieResponse` and `EffieResponseOptions` have moved from `@effing/effie` to `@effing/fn`.
  A new `imageResponse` helper is available in `@effing/fn` for serving single images.

  The starter template now uses `@effing/fn` for pluggable module loading (`fnModule`),
  URL building (`fnUrl`), and response helpers. Modules use `.fn.tsx` extension and export
  `runner` instead of `renderer`. A new "image" function kind is supported alongside
  annies and effies.

### Patch Changes

- f40d92a: Accept Uint8Array in imageResponse and avoid redundant copy

  The `imageResponse` helper now accepts `Uint8Array` instead of `Buffer`, widening
  compatibility beyond Node.js. The response body is passed as the underlying
  `ArrayBuffer` directly, avoiding the previous `new Uint8Array(buffer)` copy.

- Updated dependencies [9d773d6]
  - @effing/annie@0.28.0
