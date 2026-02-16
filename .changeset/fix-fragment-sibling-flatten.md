---
"@effing/satori": patch
---

Fix nested-array crash when Fragments have siblings

`expandElement`'s array branch now uses `flatMap` instead of `map`, so Fragment-expanded arrays are flattened into the parent. Previously, a Fragment with multiple children among siblings produced nested arrays like `[<p>, [<span>, <span>], <p>]`, causing Satori to crash with `TypeError: Cannot destructure property 'children' of 'p' as it is undefined`.
