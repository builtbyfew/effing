---
"@effing/ffs": patch
---

Propagate backend error responses instead of returning generic 500s

When FFS delegates rendering to a backend instance, error responses are now
parsed for structured error info (code, message) and propagated to the caller.
Previously all backend failures surfaced as INTERNAL_ERROR with a generic
message.
