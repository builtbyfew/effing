---
"@effing/ffs": patch
---

Enable HTTP proxy by default even when render backend resolver is configured

Previously, configuring a `renderBackendResolver` implicitly disabled the HTTP proxy. This caused local-fallback jobs (where the resolver returns `null`) to lose proxy URL transformation. The proxy now starts by default regardless of resolver presence; pass `httpProxy: false` to explicitly disable it.
