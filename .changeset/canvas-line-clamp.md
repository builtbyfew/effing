---
"@effing/canvas": minor
---

Add lineClamp support to canvas renderer

The canvas renderer now supports the `lineClamp` CSS property, which truncates
text to a maximum number of visible lines and appends an ellipsis. Also fixes an
off-by-one in `truncateWithEllipsis` that could leave one character of headroom
unused.
