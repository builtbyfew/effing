# @effing/annie

## 0.31.2

## 0.31.1

## 0.31.0

## 0.30.2

## 0.30.1

## 0.30.0

## 0.29.1

### Patch Changes

- 8825191: Drop unused `@effing/serde` dependency

  `@effing/annie` no longer imports anything from `@effing/serde`, so the
  runtime dependency has been removed. No public API change.

## 0.29.0

### Patch Changes

- Updated dependencies [01e4e6a]
  - @effing/serde@0.29.0

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

- @effing/serde@0.28.0

## 0.27.0

### Patch Changes

- @effing/serde@0.27.0

## 0.26.1

### Patch Changes

- 64c9b1f: Change license from O'Saasy to MIT
- Updated dependencies [64c9b1f]
  - @effing/serde@0.26.1

## 0.26.0

### Patch Changes

- @effing/serde@0.26.0

## 0.25.1

### Patch Changes

- @effing/serde@0.25.1

## 0.25.0

### Patch Changes

- @effing/serde@0.25.0

## 0.24.8

### Patch Changes

- @effing/serde@0.24.8

## 0.24.7

### Patch Changes

- @effing/serde@0.24.7

## 0.24.6

### Patch Changes

- @effing/serde@0.24.6

## 0.24.5

### Patch Changes

- @effing/serde@0.24.5

## 0.24.4

### Patch Changes

- @effing/serde@0.24.4

## 0.24.3

### Patch Changes

- @effing/serde@0.24.3

## 0.24.2

### Patch Changes

- @effing/serde@0.24.2

## 0.24.1

### Patch Changes

- @effing/serde@0.24.1

## 0.24.0

### Patch Changes

- @effing/serde@0.24.0

## 0.23.2

### Patch Changes

- dbe77e2: Remove `@effing/satori` package and update all references to use `@effing/canvas`

  The satori package has been fully replaced by the canvas package's built-in JSX
  rendering. All documentation, code examples, and cross-references now point to
  `@effing/canvas` instead. The comparison test in canvas inlines emoji loading
  rather than importing from the removed satori package.
  - @effing/serde@0.23.2

## 0.23.1

### Patch Changes

- @effing/serde@0.23.1

## 0.23.0

### Patch Changes

- @effing/serde@0.23.0

## 0.22.3

### Patch Changes

- @effing/serde@0.22.3

## 0.22.2

### Patch Changes

- @effing/serde@0.22.2

## 0.22.1

### Patch Changes

- @effing/serde@0.22.1

## 0.22.0

### Patch Changes

- @effing/serde@0.22.0

## 0.21.1

### Patch Changes

- @effing/serde@0.21.1

## 0.21.0

### Patch Changes

- @effing/serde@0.21.0

## 0.20.1

### Patch Changes

- @effing/serde@0.20.1

## 0.20.0

### Patch Changes

- @effing/serde@0.20.0

## 0.19.3

### Patch Changes

- @effing/serde@0.19.3

## 0.19.2

### Patch Changes

- @effing/serde@0.19.2

## 0.19.1

### Patch Changes

- @effing/serde@0.19.1

## 0.19.0

### Patch Changes

- @effing/serde@0.19.0

## 0.18.6

### Patch Changes

- @effing/serde@0.18.6

## 0.18.5

### Patch Changes

- @effing/serde@0.18.5

## 0.18.4

### Patch Changes

- @effing/serde@0.18.4

## 0.18.3

### Patch Changes

- @effing/serde@0.18.3

## 0.18.2

### Patch Changes

- @effing/serde@0.18.2

## 0.18.1

### Patch Changes

- @effing/serde@0.18.1

## 0.18.0

### Patch Changes

- @effing/serde@0.18.0

## 0.17.1

### Patch Changes

- @effing/serde@0.17.1

## 0.17.0

### Patch Changes

- @effing/serde@0.17.0

## 0.16.0

### Patch Changes

- @effing/serde@0.16.0

## 0.15.1

### Patch Changes

- @effing/serde@0.15.1

## 0.15.0

### Patch Changes

- @effing/serde@0.15.0

## 0.14.1

### Patch Changes

- @effing/serde@0.14.1

## 0.14.0

### Patch Changes

- @effing/serde@0.14.0

## 0.13.1

### Patch Changes

- @effing/serde@0.13.1

## 0.13.0

### Patch Changes

- @effing/serde@0.13.0

## 0.12.0

### Patch Changes

- @effing/serde@0.12.0

## 0.11.2

### Patch Changes

- @effing/serde@0.11.2

## 0.11.1

### Patch Changes

- @effing/serde@0.11.1

## 0.11.0

### Patch Changes

- @effing/serde@0.11.0

## 0.10.5

### Patch Changes

- @effing/serde@0.10.5

## 0.10.4

### Patch Changes

- @effing/serde@0.10.4

## 0.10.3

### Patch Changes

- @effing/serde@0.10.3

## 0.10.2

### Patch Changes

- @effing/serde@0.10.2

## 0.10.1

### Patch Changes

- @effing/serde@0.10.1

## 0.10.0

### Patch Changes

- @effing/serde@0.10.0

## 0.9.0

### Patch Changes

- @effing/serde@0.9.0

## 0.8.0

### Patch Changes

- @effing/serde@0.8.0

## 0.7.3

### Patch Changes

- @effing/serde@0.7.3

## 0.7.2

### Patch Changes

- @effing/serde@0.7.2

## 0.7.1

### Patch Changes

- @effing/serde@0.7.1

## 0.7.0

### Patch Changes

- @effing/serde@0.7.0

## 0.6.1

### Patch Changes

- @effing/serde@0.6.1

## 0.6.0

### Patch Changes

- @effing/serde@0.6.0

## 0.5.0

### Patch Changes

- @effing/serde@0.5.0

## 0.4.1

### Patch Changes

- @effing/serde@0.4.1

## 0.4.0

### Patch Changes

- @effing/serde@0.4.0

## 0.3.0

### Patch Changes

- @effing/serde@0.3.0

## 0.2.0

### Patch Changes

- @effing/serde@0.2.0

## 0.1.2

### Patch Changes

- @effing/serde@0.1.2

## 0.1.1

### Patch Changes

- @effing/serde@0.1.1
