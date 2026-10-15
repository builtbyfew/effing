---
"@effing/dev": patch
---

Stop the dev server from leaking listeners while it looks for a free port

Each port that turned out to be taken left a `listening` callback on the server, so walking past more than ten of them printed a `MaxListenersExceededWarning`, and all of those callbacks fired once a port was free.
