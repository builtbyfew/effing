---
"@effing/create": patch
---

Slugify project name and apply to effing-cloud config

The scaffolder now slugifies the directory basename (lowercase, non-alphanumeric
characters collapsed to hyphens) and writes it to both `package.json#name` and
`effing-cloud.config.ts#project`. Previously the cloud config kept its template
default of `"starter"`, which would collide for every scaffolded project.
