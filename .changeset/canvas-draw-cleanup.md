---
"@effing/canvas": patch
---

Clean up draw system and make comparison tests work offline

Deduplicate drawNode/drawNodeInner into a single drawNodeCore function, extract
shared CSS utilities to draw/utils.ts, reuse the existing hasRadius helper, and
consolidate redundant getBorderRadius wrappers. Comparison tests now fall back to
local Liberation Sans fonts and skip emoji tests when the network is unavailable.
