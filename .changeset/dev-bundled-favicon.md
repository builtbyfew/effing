---
"@effing/dev": patch
"@effing/create": patch
---

Bundle the dev-server favicon with `@effing/dev` and drop user-public-dir support

The favicon shown in the local dev-server browser tab is now shipped as
branding inside `@effing/dev` rather than something each project has to
carry. The previously unused user `public/` directory branch in the dev
server has been removed, and the starter template no longer includes a
`public/` directory (production servers built by `effing build` never
served those files).
