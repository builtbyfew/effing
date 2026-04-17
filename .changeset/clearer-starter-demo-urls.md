---
"@effing/create": minor
---

Use clearer URL segments in starter demo routes

The scaffolded starter now routes annies/effies/images at `/annie/:segment`,
`/effie/:segment`, `/image/:segment` with preview pages under
`/preview/annie/:id`, `/preview/effie/:id`, `/preview/image/:id`, replacing the
cryptic two-letter segments (`an`, `ff`, `im`, `pan`, `pff`, `pim`). The
`kindPrefix` indirection in `fn.server.ts` is gone since the URL segment now
equals the `FnKind`.
