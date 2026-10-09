---
"@effing/canvas": patch
---

Use @effing/skia's own `line-height: normal` instead of computing it in canvas; drop other workarounds the fork no longer needs. No visible change.

Text with `textOverflow: "ellipsis"` is now measured with its ellipsis, as it's drawn. Its measured height is unchanged, and so is its width almost always, since the paragraph's max-content width ignores the ellipsis. The one exception: `nowrap` or `pre` text with an ellipsis has its max-content width measured a line at a time, as it's drawn. A line shaped on its own can come out wider or narrower than the same line shaped as part of the whole text. @effing/skia documents one right-to-left line with fallback fonts that came out 14px off. Such a node is now as wide as its drawn line.
