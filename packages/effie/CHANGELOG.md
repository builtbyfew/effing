# @effing/effie

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
