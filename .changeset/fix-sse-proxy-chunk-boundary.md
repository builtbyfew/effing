---
"@effing/ffs": patch
---

fix(ffs): preserve SSE parser state across chunks in `proxyRemoteSSE`

`currentEvent`/`currentData` were reinitialized on every read chunk, so SSE events whose terminating blank line arrived in a subsequent chunk were silently dropped. Move parser state outside the read loop so events spanning chunk boundaries are correctly forwarded.
