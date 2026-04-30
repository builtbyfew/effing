---
"@effing/create": patch
---

Rename starter `fonts.server.ts` to `fonts.ts`

The file has no server-only secrets or APIs, and `.fn.tsx` files (which import
it) already lack a `.server` suffix despite running server-only — so the marker
was inconsistent and added complexity without earning its keep.
