---
"@effing/satori": minor
---

Move `@resvg/resvg-js` from dependencies to peerDependencies so it is always resolvable from the consumer's project root (required for pnpm and SSR builds that externalize native addons)
