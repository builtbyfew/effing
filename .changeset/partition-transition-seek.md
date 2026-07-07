---
"@effing/effie": patch
---

Subtract transition overlap when accumulating the video-background seek in `effieDataForSegment`, so partitioned renders match the monolithic renderer's background timeline under xfade transitions.
