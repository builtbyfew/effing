---
"@effing/annie": patch
"@effing/canvas": patch
"@effing/tween": patch
"@effing/create": patch
---

Remove `@effing/satori` package and update all references to use `@effing/canvas`

The satori package has been fully replaced by the canvas package's built-in JSX
rendering. All documentation, code examples, and cross-references now point to
`@effing/canvas` instead. The comparison test in canvas inlines emoji loading
rather than importing from the removed satori package.
