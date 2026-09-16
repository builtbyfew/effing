---
"@effing/canvas": minor
---

Add `clipPath` and `backdropFilter` support to `renderReactElement`.

`clipPath` clips an element's entire rendering — background, borders,
box-shadow and children — in the element's own (transformed) coordinate space.
It supports the basic shapes (`inset()` with `round`, `circle()`, `ellipse()`,
`polygon()`, `path()`, `rect()`, `xywh()`), the `shape()` function with its
`move`/`line`/`hline`/`vline`/`curve`/`smooth`/`arc`/`close` commands, the
geometry-box keywords (`border-box`, `padding-box`, `content-box`,
`margin-box`) alone or as a shape's reference box, and `none`. `url(#id)`
references and `calc()` are not supported; an unrecognised value leaves the
element unclipped, as a browser would drop an invalid declaration.

`backdropFilter` filters whatever is already painted behind the element's
border box (following `borderRadius`) and paints it back before the element's
own background, giving the usual frosted-glass effect with a translucent
background on top. It takes the same filter functions as `filter`, snapshots
the backdrop in device space so it works under any transform, and scales
`blur()` lengths with the transform so a `blur(10px)` stays 10 CSS pixels wide.
A subtree containing a backdrop-filter bypasses the offscreen scale
optimisation, since the filter needs the real canvas content behind it.

Both properties resolve `em`, `rem`, viewport and absolute units like the
other string-valued properties, and the `WebkitClipPath` /
`WebkitBackdropFilter` vendor aliases map to the unprefixed names.
