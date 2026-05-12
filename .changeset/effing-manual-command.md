---
"@effing/dev": minor
"@effing/create": minor
---

Add `effing manual` command

The new `effing manual` CLI prints a tool-level reference for the `effing` CLI and the fn module shape, tailored to the project's configured globs, default resolution, and detected package manager. Commands in the manual use each PM's local-only invocation form — `pnpm exec` / `yarn` / `npx --no` for the three recognized ones, and `./node_modules/.bin/effing` as a safe fallback for bun and anything else — so a copy-pasted command never falls back to fetching the unrelated `effing` package from the npm registry. The starter's `AGENTS.md` now directs agents to run it before touching any fn, and `GUIDE.md` is trimmed to project-specific conventions (path alias, font helpers, package.json scripts, deploying) — removing the staleness risk of the previously-static manual scaffolded once at project creation.
