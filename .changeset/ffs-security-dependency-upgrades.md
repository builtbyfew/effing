---
"@effing/ffs": patch
---

Upgrade dependencies to address security advisories

Bumps undici to ^7.29.0 (HTTP smuggling, CRLF injection, cache-poisoning and
WebSocket DoS advisories), body-parser to ^1.20.6 and express to ^4.22.2
(pulling in qs 6.15.3 to fix DoS advisories), and sharp to ^0.35.0 (inherited
libvips CVEs). No advisories remain in the package's dependency tree.
