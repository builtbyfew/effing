---
"@effing/ffs": patch
---

`EffieRenderer.close()` stops every render in progress. A render still fetching its sources no longer starts FFmpeg once the fetches finish. `FFmpegRunner.close()` likewise keeps FFmpeg from starting, and a closed runner can't run again
