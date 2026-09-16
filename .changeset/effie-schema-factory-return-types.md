---
"@effing/effie": patch
---

Give the `createEffie*Schema` factories explicit, named return types.

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
