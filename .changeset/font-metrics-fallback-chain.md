---
"@effing/canvas": patch
---

Handle comma-separated font-family in getFontMetrics

`getFontMetrics` previously matched against the full CSS `font-family` string
(e.g. `"CentraNo1, Liberation Sans"`), which never matched cache keys stored
under individual family names. It now splits on commas and tries each name,
so hhea metrics are correctly resolved for fonts used with fallback chains.
