---
"@effing/dev": patch
---

Security dependency upgrades: vite 7.3.6, react-router 7.18.2, esbuild 0.28.2

Resolves all 16 audit advisories reachable through @effing/dev, including the
Vite dev server arbitrary file read (GHSA-p9ff-h696-f583) and `server.fs.deny`
bypasses, the React Router RSC CSRF bypass (GHSA-qwww-vcr4-c8h2) and route
matching DoS, and transitive fixes for picomatch, valibot, and @babel/core.
