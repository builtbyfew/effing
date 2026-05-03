---
"@effing/create": patch
---

Split starter reference docs into a separate `GUIDE.md`

Scaffolded projects now ship a slim `README.md` (title and a one-line pointer) alongside a self-contained `GUIDE.md` covering setup, project structure, writing fns, fonts, env vars, scripts, and deployment. `AGENTS.md` points agents at `GUIDE.md` so user edits to the README can't accidentally strip the content agents and new contributors rely on.
