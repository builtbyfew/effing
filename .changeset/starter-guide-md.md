---
"@effing/create": patch
---

Split starter reference docs into a separate `GUIDE.md`

Scaffolded projects now ship a slim `README.md` (title and a one-line pointer) alongside a self-contained `GUIDE.md` covering setup, project structure, writing fns, fonts, env vars, scripts, and deployment. `AGENTS.md` points agents at `GUIDE.md` so user edits to the README can't accidentally strip the content agents and new contributors rely on. The post-scaffold CLI message now points to `GUIDE.md` rather than listing inline steps, so the `.env` setup step is no longer missed.
