---
"@effing/ffs": patch
"@effing/create": patch
---

Disable HTTP redirect following in ffsFetch for SSRF protection

Redirects can bypass SSRF validation by first targeting an allowed URL that
redirects to an internal IP. ffsFetch now uses `redirect: "manual"` and rejects
any 3xx response with a descriptive error. Demo preview URLs updated from
picsum.photos (which relies on redirects) to direct static.effing.dev URLs.
