---
"@effing/canvas": patch
---

Support borderRadius on per-side borders

Individual borders (different widths/colors per side) now draw rounded corner
arcs instead of straight lines when borderRadius is set. Each corner arc is
assigned to exactly one side to avoid double-stroking anti-aliasing artifacts.
