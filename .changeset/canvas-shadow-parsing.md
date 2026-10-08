---
"@effing/canvas": patch
---

Parse `boxShadow` and `textShadow` as CSS does

- `boxShadow` takes a comma-separated list, painted with the first shadow on
  top. `inset` shadows are now cast inside the padding box, clipped to its
  rounded corners, rather than drawn as outer shadows, and a spread now grows
  (or, negative, shrinks) the shadow and its corner radii. The colour may come
  first, and a shadow without one is cast in the element's `color`.
- `textShadow` now draws without a blur radius (`3px 3px red`), with the
  colour first (`red 3px 3px 4px`) or left out (cast in the text's colour),
  and as a list of shadows, the first on top.
- Lengths in `em`, `rem`, `vw`, `pt` and the other units canvas resolves
  elsewhere now work in both.
- An invalid value casts no shadow, as CSS ignores it. A list used to be
  read as one shadow, with the rest of the list as its colour.

Also stop a `url()` background on an element with a border radius from
clipping what is painted after it: the rounded clip used to stay for the
element's text, image and children, cutting a child that overflows the
element's corners.
