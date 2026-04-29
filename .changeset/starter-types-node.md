---
"@effing/create": patch
---

Add `@types/node` to starter devDependencies

The starter's `tsconfig.json` declares `"types": ["node", "vite/client"]`,
but `@types/node` was not listed in the package's devDependencies. Inside
this monorepo it resolved via workspace hoisting, but projects scaffolded
from the template via `pnpm create @effing` failed to typecheck with
missing-node-types errors.
