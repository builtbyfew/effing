---
"@effing/ffs": patch
---

Security dependency refresh: regenerate the lockfile so all transitive
dev-tooling dependencies resolve to their newest in-range patched versions,
resolving 40 of the 41 remaining audit advisories (minimatch, brace-expansion,
flatted, ajv, js-yaml, yaml, markdown-it, linkify-it, rollup, postcss, nanoid,
and undici). Also align `@types/express` with the express 4 runtime (`^4.17.25`
instead of `^5.0.0`), which keeps `req.params` values typed as plain strings —
the v5 types model express 5 behavior where params can be `string | string[]`.
