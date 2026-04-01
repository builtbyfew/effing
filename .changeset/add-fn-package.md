---
"@effing/fn": minor
"@effing/annie": minor
"@effing/effie": minor
"@effing/create": minor
---

Move response helpers to @effing/fn and restructure starter template using @effing/fn

`annieResponse` and `AnnieResponseOptions` have moved from `@effing/annie` to `@effing/fn`.
`effieResponse` and `EffieResponseOptions` have moved from `@effing/effie` to `@effing/fn`.
A new `imageResponse` helper is available in `@effing/fn` for serving single images.

The starter template now uses `@effing/fn` for pluggable module loading (`fnModule`),
URL building (`fnUrl`), and response helpers. Modules use `.fn.tsx` extension and export
`runner` instead of `renderer`. A new "image" function kind is supported alongside
annies and effies.
