---
"@effing/canvas": patch
---

Parse border colours as browsers do

- The `border` and per-side border shorthands no longer split a colour that contains spaces, such as `rgba(0, 0, 255, 0.5)`, into pieces, and take the width, style and colour in any order (`solid red 2px`). A style of `none` or `hidden` gives no border, a style without a width (`solid red`) gives a medium (3px) border, and width keywords (`thin`, `medium`, `thick`) are understood here and in `borderWidth` and its longhands.
- `borderColor` takes one to four values, as `borderWidth` does.
- A border without a colour, such as `border: "1px solid"`, is drawn in the element's `color` (`currentColor`), as in CSS, where it was black. This changes how an element with a non-black `color` and such a border renders.
- `color: "inherit"`, `color: "currentColor"` and an invalid colour now take the parent's colour, for text as well as borders, where text was drawn in whatever fill was last set.
