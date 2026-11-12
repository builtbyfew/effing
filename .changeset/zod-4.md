---
"@effing/effie": minor
"@effing/fn": minor
"@effing/annie": minor
"@effing/dev": minor
"@effing/ffs": minor
"@effing/create": minor
---

Upgrade to zod 4

- The zod peer dependency of `@effing/effie` and `@effing/fn` is now `^4.5.0`
  (was `^3.0.0`). The exported Effie schemas are zod 4 schemas,
  and `propsSchema` in a fn module is typed as a zod 4 `z.ZodType`. Projects
  that still use zod 3 need to upgrade to zod 4 too (see the
  [zod 4 migration guide](https://zod.dev/v4/changelog)).
- `@effing/annie` no longer declares zod as an (unused) optional peer
  dependency.
- Validation error messages follow zod 4's wording, e.g.
  `Invalid input: expected number, received string` and
  `Unrecognized key: "extra"`. This shows in the `issues` that FFS returns for
  an invalid Effie. Union mismatches (a transition, effect, motion or
  background) report as before: an unrecognized key on the matching branch is
  reported as such, other mismatches as `Invalid input` at the union's path.
  The one change is that a value that partially matches several branches (e.g.
  a `fade` transition with both `easing` and `through`) now yields
  `Invalid input` instead of an unrecognized-key issue. The peer range starts
  at 4.5.0 because older zod 4 releases report less detail for these
  mismatches.
- `z.number()` in zod 4 no longer accepts `Infinity`, so an Effie with an
  infinite number (which JSON cannot express anyway) is now rejected.
- `resolutions` in the dev config is still required to be non-empty, but its
  inferred type is now a plain array rather than a non-empty tuple.
- The starter template, demos and docs now use `z.url()` instead of the
  deprecated `z.string().url()`.
