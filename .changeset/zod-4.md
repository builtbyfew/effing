---
"@effing/effie": minor
"@effing/fn": minor
"@effing/annie": minor
"@effing/dev": minor
"@effing/ffs": minor
"@effing/create": minor
---

Upgrade to zod 4

- The zod peer dependency of `@effing/effie`, `@effing/fn` and `@effing/annie`
  is now `^4.0.0` (was `^3.0.0`). The exported Effie schemas are zod 4 schemas,
  and `propsSchema` in a fn module is typed as a zod 4 `z.ZodType`. Projects
  that still use zod 3 need to upgrade to zod 4 too (see the
  [zod 4 migration guide](https://zod.dev/v4/changelog)).
- Validation error messages follow zod 4's wording, e.g. `Invalid input:
expected number, received string` and `Unrecognized key: "extra"`. This shows
  in the `issues` that FFS returns for an invalid Effie. A value that matches
  no branch of a union (a transition, effect, motion or background) still
  reports the closest branch's issue, except when several branches partially
  match (e.g. a `fade` transition with both `easing` and `through`), which now
  yields a single `Invalid input` issue at that path. Early zod 4.0.x releases
  report a single `Invalid input` for every union mismatch.
- `z.number()` in zod 4 no longer accepts `Infinity`, so an Effie with an
  infinite number (which JSON cannot express anyway) is now rejected.
- `resolutions` in the dev config is still required to be non-empty, but its
  inferred type is now a plain array rather than a non-empty tuple.
- The starter template, demos and docs now use `z.url()` instead of the
  deprecated `z.string().url()`.
