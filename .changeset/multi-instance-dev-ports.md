---
"@effing/dev": minor
"@effing/create": patch
---

Make running multiple dev servers side by side work out of the box

`effing dev` now handles port collisions instead of crashing with a raw
EADDRINUSE: when no port was chosen explicitly, it walks up from 3839 to the
next free port; explicitly chosen ports (`--port` or `dev.port`) stay strict
and fail fast with a clear message. Everything downstream follows the chosen
port automatically — `BASE_URL` defaults to the dev server's own address when
unset (with a startup warning when a stale localhost `BASE_URL` points at a
different port), each instance's FFS sidecar gets its own free port (starting
at 2000) with `FFS_BASE_URL` auto-set to match, and `effing url` defaults
`BASE_URL` to the configured dev address. The preview's FFS flows no longer
require `FFS_API_KEY` — the auth header is only sent when a key is set,
matching the sidecar, which doesn't enforce auth without one. Vite's unused
HMR WebSocket server (a hidden cross-instance collision on port 24678) is now
disabled. The starter template's `.env.example` and guide reflect the new
defaults: only `SECRET_KEY` is required in development.
