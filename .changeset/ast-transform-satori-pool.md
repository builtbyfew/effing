---
"@effing/satori": patch
---

Replace regex-based `createSatoriPool()` rewriting with AST-based transform to avoid false matches in strings, comments, shadowed identifiers, and unrelated same-name functions
