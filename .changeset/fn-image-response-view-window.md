---
"@effing/fn": patch
---

Fix `imageResponse` serving the entire backing buffer instead of the view window, which corrupted images backed by offset views (e.g. pooled Buffers) and leaked adjacent buffer bytes
