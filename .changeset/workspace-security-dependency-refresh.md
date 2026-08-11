---
"@effing/ffs": patch
---

Security dependency refresh: regenerate the lockfile so all transitive
dev-tooling dependencies resolve to their newest in-range patched versions,
resolving 40 of the 41 remaining audit advisories (minimatch, brace-expansion,
flatted, js-yaml, yaml, markdown-it, linkify-it, rollup, postcss, nanoid, and
undici). The `@types/express` 5.0.6 bump types `req.params` values as
`string | string[]`, so the three `:id` route handlers now declare their params
as `Request<{ id: string }>` — a type-only change with no runtime impact.
