---
"@effing/dev": patch
---

Pass `--skip-validation` and `--allow-local-files` through `effing render`

`effing render effie` now forwards both flags to the `ffs render` it spawns, so a composition that doesn't pass schema validation, or one with `file://` sources, can be rendered from a fn id without calling `ffs render` by hand. Like `--scale`, they apply to effies only and are an error for images and annies.
