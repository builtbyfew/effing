---
"@effing/ffs": patch
---

Make sharp an optional dependency for lighter installs when delegating rendering

FFS instances that delegate rendering to a remote backend never use sharp locally.
Sharp is now in `optionalDependencies` and imported lazily, so `pnpm install
--no-optional` produces a working install without sharp's native binaries.
