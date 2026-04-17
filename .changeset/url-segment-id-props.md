---
"@effing/serde": minor
"@effing/create": minor
---

Switch demo URL segments to `{ id, props }` shape and make serde key conversion recursive

The demos/starter URL segments now serialize as `{ id, props }` instead of
spreading props at the top level alongside a kind-specific id key
(`{ imageId | annieId | effieId, ...props }`). This gives a uniform contract
for all three kinds and a clean separation between the module identifier and
its props.

To preserve Python `snake_case` → `camelCase` interop for prop names now
nested one level deeper under `props`, `@effing/serde`'s
`convertKeysToCamel` conversion in `deserialize` is now recursive across
plain objects and arrays; primitives and non-plain objects (Date, Buffer,
class instances) still pass through unchanged.
