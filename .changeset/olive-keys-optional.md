---
"@effing/create": patch
---

Starter template: wire up `npm run render` alongside `npm run url`, and note in the docs that `SECRET_KEY` is now optional in dev — `effing dev` and `effing render` generate a throwaway key per run; `npm run url` and production still require a configured one.
