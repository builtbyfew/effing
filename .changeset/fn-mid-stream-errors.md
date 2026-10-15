---
"@effing/fn": patch
---

Abort the response of an fn that fails mid-stream in the fn server

When an annie threw after its first frame, the fn server ended the response cleanly, so clients got a complete-looking but truncated TAR, and FFS rendered the annie with fewer frames instead of failing. The response is now aborted.
