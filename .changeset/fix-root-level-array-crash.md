---
"@effing/satori": patch
---

Fix crash when expanded element tree is a root-level array

When `expandElement` returns an array at the root level (e.g. from a top-level Fragment or a function component returning a Fragment), satori crashes with `TypeError: Cannot destructure property 'children' of 'p' as it is undefined` because it expects a single element, not an array.

Added `ensureSingleElement` which wraps root-level arrays in a `<div style={{display: "contents"}}>` — a layout-transparent wrapper that preserves Fragment semantics. Applied in both the pool (before serialization) and the worker (after deserialization) for defense in depth.
