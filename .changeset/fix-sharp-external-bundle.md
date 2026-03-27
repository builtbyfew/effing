---
"@effing/ffs": patch
---

Mark sharp as external in tsup build config

When sharp moved from dependencies to optionalDependencies, tsup stopped
auto-externalizing it and bundled its JS source into the dist output. Since
sharp's native .node binaries can't be bundled, the import failed at runtime.
Explicitly marking sharp as external keeps it as a bare import resolved from
node_modules.
