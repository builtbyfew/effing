---
"@effing/dev": patch
---

`effing render effie` starts half the app workers and loads the fns in them while FFS starts up, instead of when FFS first asks for the effie and its layers. It imports every fn in the project, so module-level code of fns the render doesn't use now runs too
