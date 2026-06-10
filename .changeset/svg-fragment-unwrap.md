---
"@effing/canvas": patch
---

Unwrap React fragments inside SVG subtrees

Fragments inside `<svg>` previously kept their `Symbol(react.fragment)` type
through layout, so the SVG drawer silently skipped them and fragment-rooted
icons rendered as empty. Fragments are now unwrapped during SVG tree
resolution, so their children draw (and resolve `currentColor`) as if placed
directly in the parent element.
