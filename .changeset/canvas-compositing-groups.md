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

Four things to know when upgrading:

- Frames with translucent or filtered elements that have overlapping
  descendants render differently (correctly).
- A `filter` on an image with `borderRadius` now blurs its rounded edge, as in
  a browser.
- A group that holds more than 32 MiB of decoded images (one photo of about
  8 megapixels) is composited in two parts: what the element paints after
  such an image no longer hides it while the element is translucent.
- A group is composited through an offscreen buffer the size of the canvas,
  which costs about 0.4 ms per translucent element on a 1080×1080 frame. An
  element with `overflow: hidden` gets a buffer its own size and costs next to
  nothing.
