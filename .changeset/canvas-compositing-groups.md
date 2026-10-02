---
"@effing/canvas": minor
---

Apply `opacity` and `filter` to an element and its descendants as one group,
and filter backdrops natively.

`opacity` and `filter` used to be applied to each drawing operation, so
overlapping children of a fading element showed through each other, and a
`drop-shadow()` was cast by every child separately. An element with either is
now composited as a group (`beginGroup` / `endGroup` of `@effing/skia`), which
is what CSS specifies.

`backdropFilter` is a native backdrop group instead of a snapshot filtered in
JavaScript: about a third faster in our benchmark. As in browsers, an ancestor
with `opacity` below 1 or a `filter` is now a backdrop root, so an element
inside it filters only what that ancestor has painted so far.

Two things to know when upgrading:

- Frames with translucent or filtered elements that have overlapping
  descendants render differently (correctly).
- A `filter` on an image with `borderRadius` now blurs its rounded edge, as in
  a browser. For a sharp edge, give the image a `clipPath` or wrap it in an
  element with `overflow: hidden`.
