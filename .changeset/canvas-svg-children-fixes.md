---
"@effing/canvas": patch
---

Fix function components and array helpers inside `<svg>`

Function components nested inside an `<svg>` element are now expanded (previously they were silently dropped because the SVG drawer only matched primitive element strings). Helpers that return arrays of SVG children no longer crash the defs collector — nested arrays are flattened during the layout pass.
