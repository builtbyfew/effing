---
"@effing/canvas": patch
---

Keep emoji with their punctuation, and clamp lines as Chrome does

`@effing/skia` is now 1.0.10-effing.4.

- An emoji drawn as an image stays with the punctuation next to it, as in
  Chrome: `Hi 🎉! ok` breaks as `Hi | 🎉! | ok` where the "!" doesn't fit
  after the emoji, no longer as `Hi 🎉 | ! ok`, and `(🎉)` is never split.
- A `lineClamp` line that ends at a newline under `whiteSpace: "pre-line"` or
  `"pre-wrap"` now ends in an ellipsis, as in Chrome (`"ab\ncd"` clamped to
  one line is "ab…"), and an empty clamped line is the ellipsis alone.
- The last line `lineClamp` shows is its own text with the ellipsis after it,
  cut by grapheme cluster until the two fit, as in Chrome: it no longer takes
  in the start of the next line's text ("ab cd…", not "ab cd e…"), and no
  longer keeps the space before the ellipsis ("aaaa bb…", not "aaaa bb …").
  `pre-wrap` keeps those spaces, as Chrome does.
