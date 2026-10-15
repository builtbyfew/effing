---
"@effing/dev": patch
---

Keep the dev server running when an fn fails after its response has started

An annie that threw after its first frame left an unhandled rejection behind: it stopped `effing dev` with `dev.workers: 0`, and otherwise stopped the app worker, failing every other request that worker was serving (such as the other annies of the same effie). The error is now logged with the request URL and the response aborted, so the client sees it failed.
