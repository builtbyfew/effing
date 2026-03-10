---
"@effing/canvas": patch
---

Resolve CSS units in `fontSize` and `letterSpacing` during style resolution

`fontSize: "4em"`, `"2rem"`, `"24px"` etc. are now resolved to pixel values in
`resolveStyle`, so downstream consumers always see a number. Introduces
`ExpandedStyle` to type the pre-resolution stage cleanly, keeping
`ComputedStyle.fontSize` strictly `number`.
