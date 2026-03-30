---
"@effing/ffs": minor
---

Add SSRF protection to ffsFetch

All outbound HTTP requests now validate URLs against private/internal IP ranges
(loopback, RFC 1918, link-local, cloud metadata, IPv6 unique local) with DNS
pre-resolution to catch hostnames that resolve to blocked addresses. Protection
is enabled by default in production (NODE_ENV=production) and can be overridden
via FFS_ALLOW_PRIVATE_NETWORKS=true|false.
