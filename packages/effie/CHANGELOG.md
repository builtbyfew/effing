# @effing/effie

## 0.47.1

### Patch Changes

- 174d3f5: FFS now takes a layer's `delay`, `from` and `until` to mean their nearest frame. A layer handing over to the next at times given off the frame grid, such as `until: 2.933` and `delay: 2.967` for frames 88 and 89 at 30 fps, no longer leaves those frames uncovered. Exact fractions such as `107/30`, which floating point puts a hair past the frame, no longer drop a frame either. A motion's `start` snaps to a frame too, counted from the frame the layer's content starts on, so a delayed layer's motion is active from its first frame.

## 0.47.0

## 0.46.2

## 0.46.1

## 0.46.0

### Patch Changes

- e3525d7: Document QOI image layers and backgrounds

  Image layers and image backgrounds can be PNG, JPEG or QOI images. The cover should stay a PNG or JPEG, since it is meant to be shown in browsers, which can't display QOI.

- f87422e: Document that a shake's `frequency` is its speed in half-turns per second, not in Hz (one circle every 2/frequency seconds, default 4), and the defaults of the motion `start` (0) and `duration` (1)
- 9519ba3: Document that a shake's `intensity` is its maximum offset along each axis in pixels of the full-size frame (default 10), scaled with the render

## 0.45.1

## 0.45.0

## 0.44.0

## 0.43.0

## 0.42.0

## 0.41.1

## 0.41.0

### Patch Changes

- ce15abd: Give the `createEffie*Schema` factories explicit, named return types.

  Each factory is now declared as a generic overload returning
  `z.ZodType<Effie*<EffieSources<U>, U>>`, so `z.infer` on a factory result
  yields the corresponding `Effie*` type alias, the same shape the default
  `effie*Schema` constants already expose. The returned schemas are typed as
  `ZodType` rather than `ZodObject`, so `.shape`, `.extend` and similar
  object-specific helpers are no longer available on factory results.

  This also stabilises the generated API docs: the inferred zod object types were
  printed by TypeScript's type printer, whose union member order depends on
  internal type ids and shifted whenever unrelated files elsewhere in the
  monorepo changed.

## 0.40.2

## 0.40.1

## 0.40.0

## 0.39.0

### Patch Changes

- 3d4fb42: Subtract transition overlap when accumulating the video-background seek in `effieDataForSegment`, so partitioned renders match the monolithic renderer's background timeline under xfade transitions.
- d125693: Validate background colors instead of accepting arbitrary strings

  The `color` background's `color` field previously accepted any string, and
  the FFS renderer interpolated it directly into an ffmpeg lavfi filtergraph
  (`color=<value>:size=...`), so a crafted value could smuggle extra lavfi
  filters into the render. The Effie schema now constrains `color` to the
  forms ffmpeg's `color` source accepts — named colors, `#RRGGBB[AA]`, and
  `0xRRGGBB[AA]`, each with an optional `@alpha` suffix — and the FFS renderer
  independently rejects colors containing filtergraph metacharacters, which
  also covers renders that skip schema validation (`FFS_SKIP_VALIDATION`).

## 0.38.4

## 0.38.3

## 0.38.2

## 0.38.1

## 0.38.0

## 0.37.1

## 0.37.0

## 0.36.2

## 0.36.1

## 0.36.0

## 0.35.3

## 0.35.2

### Patch Changes

- 9143bdd: Document that transitions overlap the previous segment and end at the segment boundary

## 0.35.1

## 0.35.0

## 0.34.0

## 0.33.1

### Patch Changes

- b18e42f: Document what scroll `distance` means and how to size the layer source
- c481551: Correct README to say segment audio is mixed on top of the global track, not overriding it

## 0.33.0

### Patch Changes

- a975209: Fix layer `delay` extending the rendered segment past `segment.duration`

  When a layer had `delay > 0`, the renderer prepended a `nullsrc` to the layer stream that pushed its length to `segment.duration + delay`. ffmpeg's overlay default `eof_action=repeat` then extended the rendered output past `segment.duration`, with the background's last frame frozen during the tail. The fix trims the source to `segment.duration - delay` before the `nullsrc` prefix, so the padded layer matches the background length. The `@effing/effie` README is also updated to clarify that `delay` defers when a layer's content starts playing, while `from` is a visibility gate that lets content keep playing from `t = 0` regardless.

## 0.32.0

## 0.31.4

## 0.31.3

## 0.31.2

## 0.31.1

## 0.31.0

## 0.30.2

## 0.30.1

### Patch Changes

- a599d8c: Expand README with full Effie format reference and add JSDoc breadcrumbs on helpers

  The README now documents the EffieBackground variants, EffieAudio (including the runtime-enforced volume range), segment/layer semantics (bottom-to-top stacking, first-segment transition ignored), the cover/`#ref` rule, validation usage (identity helpers vs `effieDataSchema.safeParse`), and a Runtime Constraints section splitting what the schema enforces from what callers must guard themselves. `effieData` and `effieSegment` gain JSDoc that survives tsup bundling and points consumers at the README from `dist/index.d.ts`.

- bc9afd0: Correct README and JSDoc descriptions of `from`/`until` and `delay`

  The previous wording described `from`/`until` as source-time clipping and treated `delay` as separate from layer visibility. In practice (and matching FFS's renderer), all three fields are measured in segment time: `delay` shifts when the layer's content starts playing, `from` defaults to `delay` so the visibility window opens when content begins, and `until` defaults to `segment.duration`. Effect and motion `start` values are measured from when content starts (segment time `delay`), not from `t = 0`. The Runtime Constraints "NOT enforced" section is updated to match.

## 0.30.0

## 0.29.1

## 0.29.0

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

## 0.27.0

## 0.26.1

### Patch Changes

- 64c9b1f: Change license from O'Saasy to MIT

## 0.26.0

## 0.25.1

## 0.25.0

## 0.24.8

## 0.24.7

## 0.24.6

## 0.24.5

## 0.24.4

## 0.24.3

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.2

## 0.23.1

## 0.23.0

## 0.22.3

## 0.22.2

## 0.22.1

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.1

## 0.20.0

## 0.19.3

## 0.19.2

## 0.19.1

## 0.19.0

## 0.18.6

## 0.18.5

## 0.18.4

## 0.18.3

## 0.18.2

## 0.18.1

## 0.18.0

## 0.17.1

## 0.17.0

## 0.16.0

## 0.15.1

## 0.15.0

## 0.14.1

## 0.14.0

## 0.13.1

## 0.13.0

## 0.12.0

## 0.11.2

## 0.11.1

## 0.11.0

## 0.10.5

## 0.10.4

## 0.10.3

## 0.10.2

## 0.10.1

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.3

## 0.7.2

## 0.7.1

## 0.7.0

## 0.6.1

## 0.6.0

## 0.5.0

## 0.4.1

## 0.4.0

## 0.3.0

## 0.2.0

### Minor Changes

- e67c47a: Add `extractEffieSourcesWithTypes()` function

  New function that extracts source URLs along with their type information (`image`, `video`, `audio`, or `animation`). Useful for handling different source types differently during processing.
  - New types: `EffieSourceType`, `EffieSourceWithType`
  - `extractEffieSources()` now uses this internally

## 0.1.2

## 0.1.1
