# @effing/serde

## 0.30.2

## 0.30.1

## 0.30.0

## 0.29.1

## 0.29.0

### Minor Changes

- 01e4e6a: Switch demo URL segments to `{ id, props }` shape and make serde key conversion recursive

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

## 0.28.0

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

## 0.1.2

## 0.1.1
