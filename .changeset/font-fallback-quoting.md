---
"@effing/canvas": patch
---

Fix special character rendering (`€`, `²`, accented letters) by building a font fallback chain from all provided fonts and quoting multi-word family names in the CSS font shorthand passed to `@napi-rs/canvas`.
