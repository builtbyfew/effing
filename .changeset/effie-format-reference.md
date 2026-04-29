---
"@effing/effie": patch
---

Expand README with full Effie format reference and add JSDoc breadcrumbs on helpers

The README now documents the EffieBackground variants, EffieAudio (including the runtime-enforced volume range), segment/layer semantics (bottom-to-top stacking, first-segment transition ignored), the cover/`#ref` rule, validation usage (identity helpers vs `effieDataSchema.safeParse`), and a Runtime Constraints section splitting what the schema enforces from what callers must guard themselves. `effieData` and `effieSegment` gain JSDoc that survives tsup bundling and points consumers at the README from `dist/index.d.ts`.
