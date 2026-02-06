---
"@effing/ffs": patch
---

Print FFmpeg version on FFS startup

- Log the FFmpeg version string at server boot for easier debugging
- Centralize FFmpeg binary path resolution into a module-level constant
