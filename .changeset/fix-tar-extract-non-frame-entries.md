---
"@effing/ffs": patch
---

fix(ffs): drain non-frame tar entries during Annie extraction

Non-frame tar entries (e.g. directory entries, metadata) were not drained or advanced, which could stall extraction. Now these entries are resumed and skipped.
