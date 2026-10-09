# @effing/canvas

## 0.44.0

### Minor Changes

- 5d068e6: Update to @effing/skia 1.0.10-effing.6: CSS drop shadows, soft hyphens, wider justification, Chrome's baselines and font matching

  Filters:

  - `filter: drop-shadow(...)` blurs twice as much as before, as CSS defines
    it: its blur length is the standard deviation, as for `blur()`, where it
    was half of it. Halve the blur length for the old look. `boxShadow` and
    `textShadow` are unchanged.
  - Filter values that CSS rejects are now ignored, so the element has no
    filter, where they used to be clamped or drawn in black: a negative amount
    or blur length (`blur(-1px)`, `opacity(-1)`), a unitless `hue-rotate(90)`,
    or a `drop-shadow()` whose colour can't be read.

  Text:

  - A line that breaks at a soft hyphen (U+00AD) ends with a hyphen, as in
    browsers.
  - Justified text spreads at no-break spaces too, and around CJK characters
    (kana, punctuation and fullwidth forms as well as ideographs), as in
    Chrome.
  - A justified line that `lineClamp` cuts is justified first, then cut for
    the ellipsis, as in Chrome ("jumps over the la…" where it was "jumps over
    the lazy…").
  - A line that starts after the space it wrapped at no longer kerns against
    that space, so it's measured as wide as in Chrome, and a few lines break
    elsewhere.
  - With a set `lineHeight`, baselines are placed by Chrome's half-leading,
    from the font's ascent and descent rounded to whole pixels: they move by
    up to about 1px (Liberation Sans at 20px in 30px lines: 22px down each
    line, where it was 21.93px), and `textBoxTrim` trims to the rounded ascent
    and descent. `normal` line boxes don't change.
  - Text is laid out at the font size floored to 1/100px, as in Chrome
    (17.3px is 17.29px), which changes widths at fractional sizes by up to
    about 0.13%.

  Fonts:

  - A font registered under the name of a system font (through `fonts`,
    `registerFont`, `registerFontFromPath` or `GlobalFonts`) replaces that
    system family in every style, as `@font-face` does in browsers: styles you
    don't register are synthesized from the ones you do. Register every style
    you use.
  - `fontWeight` takes any weight from 1 to 1000 (`550`), as CSS does; one
    outside that range is ignored and the parent's applies.
  - A `.ttc` or `.otc` font collection loads every face in it, not only the
    first.
  - Bold italic in a family with bold and italic faces but no bold italic one
    is the italic face emboldened, as in Chrome, where it was the bold face
    slanted, and lines can break elsewhere.

  Also:

  - Emoji (and other inline images) between right-to-left words are ordered
    as the text's direction gives, where the first one used to land on the
    left; a clamped line is letter-spaced as the rest of its paragraph.
  - A `filter` list keeps applying past a transparent `drop-shadow()`, and
    accepts a colour before the lengths (`drop-shadow(red 4px 4px)`), `hsl()`
    and `hwb()` colours, and upper-case names.
  - Filtered draws (`filter`, blurred shadows) are much faster: the blur only
    covers what is drawn.

  If you draw with the re-exported `createCanvas` or `GlobalFonts` directly:
  `ctx.font` now throws for a weight outside 1 to 1000 (it used to read
  `"0 20px Arial"` as a 0px font in the family "20px Arial"), and `ctx.filter`
  keeps its previous value when given a value CSS rejects.

- 25c793c: Don't shrink text below its min-content width, so text too wide for its box stays centred

  Text that can't wrap (`whiteSpace: "nowrap"`, or a single word) and is
  wider than its box shrank to the box, and since 0.43 a line that overflows
  starts at its box's edge, so it was no longer centred in a centring parent:
  it started at the box's left edge and ran off to the right. In CSS a flex
  item is never narrower than its min-content width (`min-width: auto`), so
  Chrome keeps such text as wide as its line and centres it, overflowing on
  both sides. Canvas now does the same.

  - In a row, an element that holds only text, and a run of text between
    elements, are at least as wide as the text's widest word, or its widest
    line where it doesn't wrap, padding and borders included. A `width` or
    `maxWidth` caps that, percentages included. There is no minimum with a
    `minWidth` of the element's own, with `overflow: "hidden"` (or `scroll` or
    `auto`), or for an absolutely positioned element, as in CSS.
  - Text truncated with an ellipsis (`textOverflow: "ellipsis"` without
    wrapping, or `lineClamp`) still shrinks to its box and is truncated there.
  - Under `overflowWrap: "anywhere"`, `wordBreak: "break-all"` and
    `wordBreak: "break-word"`, words still break to fit the box. Under
    `overflowWrap: "break-word"`, the min-content is still the whole word, as
    in CSS: a word only breaks where the box can't grow to it.
  - Across a column (`alignItems: "center"` and the like), text that can't fit
    is as wide as its widest word or line, rather than the width available.
  - Lengths are laid out in units of 1/64px, as in Chrome: text widths are
    rounded up to them, and lengths in px (widths, padding, borders, margins,
    gaps, flex bases and positions) truncated. Boxes can come out a pixel
    wider or narrower where that crosses half a pixel, as in Chrome.
  - Rows whose items are all held at their minimums are laid out as in CSS.
    Yoga could size such items at millions of pixels, and now pins them at
    their minimums instead, also in rows that ran away before.

  Layouts that relied on text shrinking below its words change: a row of text
  items that can't fit now overflows its container, as in Chrome. Give an item
  `minWidth: 0` or `overflow: "hidden"` to let its box shrink (the text then
  overflows the box), or an ellipsis to truncate the text.

### Patch Changes

- c45f0a2: A `url()` background is clipped to its box, as in CSS, so a tile larger than the element no longer draws outside it. A `url()` background of a zero-size image no longer hangs the render.
- 44e55b3: Make `<br />` a forced line break inside a run of text, as in browsers

  A `<br />` used to be a flex item of its own, with no size: in a column it
  put the text after it on the next line, but in a row (the default
  `flexDirection`) `First line <br /> second line` set the two lines side by
  side, where browsers stack them.

  - A `<br />` is now part of the run of text around it, which is laid out as
    one item, and breaks the line there: in a row as in a column, at the start
    or end of the text, several in a row for empty lines, and inside
    fragments, arrays and components.
  - It breaks the line under every `whiteSpace`, `nowrap` included, and the
    spaces, tabs and newlines before and after it are removed where spaces
    collapse. Under `pre`, `pre-wrap` and `pre-line`, a newline next to it is
    a break of its own, as in browsers.
  - A `<br />` between two elements is an item of one empty line, and one with
    `display: none` is left out.
  - Text with more than one line that only breaks where it's forced to (at a
    `<br />`, or at a newline under `pre`, `pre-wrap` or `pre-line`) is now as
    wide as its widest line, rather than the full width available, so the
    items after it follow it and a background drawn behind it fits it. With
    `lineClamp`, that width leaves out the ellipsis, and the clamped line is
    truncated to fit it, as in Chrome.

  Layouts that relied on the old behaviour change:

  - `gap` no longer applies between the lines either side of a `<br />`: they
    are one item now, as in Chrome.
  - In a column, the lines either side of a `<br />` used to be separate items,
    each 23px tall with Liberation Sans at 20px. They are now lines of one
    run, spaced at the `normal` line height that canvas gives any wrapped
    text: 23px with that font, as in Chrome, so the column is as tall as
    before.

- 9c6451b: Size `line-height: normal` line boxes as Chrome does, line gap included (@effing/skia 1.0.10-effing.5)

  A `normal` line box is now the font's hhea ascent, descent and line gap, each
  rounded to whole pixels, with the baseline at the rounded ascent plus half the
  line gap (rounded down), as Chrome lays it out on macOS. Before, it was the
  unrounded ascent plus descent without the line gap, and the text's height was
  rounded up as a whole.

  Text with `line-height: normal` changes height. For fonts with a line gap, it
  gets taller by about a pixel per line: Liberation Sans at 20px is 23px a line
  where it was 22.34px, so three lines are 69px where they were 68px. For fonts
  without one, each line now rounds to a whole pixel, up or down: Noto Sans
  Myanmar at 20px is 43px a line where it was 43.68px. Glyphs move to Chrome's
  baseline, by up to about a pixel; `text-box-trim` trims to the rounded ascent
  and descent; and `findLargestUsableFontSize` can pick a smaller size where the
  taller lines no longer fit. Explicit line heights don't change.

  The metrics are those of the first available font in the `fontFamily` list,
  system fonts and fonts registered through `GlobalFonts` included. Chrome also
  grows a line for a fallback font that draws some of its text, which canvas
  doesn't yet. Chrome on Linux puts the baseline a pixel higher for fonts whose
  descent it rounds down; renders follow macOS on every platform.

  Line boxes follow fonts registered or removed through `GlobalFonts` too, as
  @effing/skia's font revision counter tells canvas of them.

  With @effing/skia 1.0.10-effing.5, text also matches Chrome in three more
  places:

  - Under `pre` and `pre-wrap`, a lone CR is kept instead of dropped. It is
    still drawn as nothing and doesn't break the line, but the letters either
    side of it no longer kern or join: `"A\rV"` is as wide as in Chrome.
  - A line or paragraph separator (U+2028, U+2029) gets `letterSpacing` once,
    not twice.
  - Under `pre`, a clamped line that ends at a newline now gets an ellipsis
    ("ab…"), as under `pre-line` and `pre-wrap`.

- 9c891c3: Parse `boxShadow` and `textShadow` as CSS does

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

- 3a45ca2: Use @effing/skia's own `line-height: normal` instead of computing it in canvas; drop other workarounds the fork no longer needs. No visible change.

  Text with `textOverflow: "ellipsis"` is now measured with its ellipsis, as it's drawn. Its measured height is unchanged, and so is its width almost always, since the paragraph's max-content width ignores the ellipsis. The one exception: `nowrap` or `pre` text with an ellipsis has its max-content width measured a line at a time, as it's drawn. A line shaped on its own can come out wider or narrower than the same line shaped as part of the whole text. @effing/skia documents one right-to-left line with fallback fonts that came out 14px off. Such a node is now as wide as its drawn line.

- 3b4d871: Size squeezed text items for the lines they draw, in rows and columns

  - A text item squeezed in a row could be sized one line tall while it drew
    several lines over the items below it. Its height had been checked against
    the lines at an earlier width, and Yoga kept sizing it from that height
    after the item moved to another width. It's now sized for the lines laid
    out at its final width.
  - A column too short for its text items no longer shrinks them below their
    lines, as `min-height: auto` keeps them in CSS: they keep the height of
    their lines at their width, and overflow the column instead of each other.
    A `height` (or `maxHeight`) caps that, and an item with `overflow: hidden`
    or a `minHeight` of its own still shrinks, as in browsers.

## 0.43.0

### Minor Changes

- 62feb35: Lay out all text natively, and support `word-break` and `overflow-wrap`

  All text is now laid out as one `@effing/skia` paragraph. The TypeScript
  layout that text the paragraph couldn't express used to fall back to is gone,
  so a text node is measured and drawn by the same layout, whatever its width.
  What changes:

  - A word wider than its line overflows it by default, as in CSS;
    `overflowWrap` (below) breaks it instead.
  - `wordBreak: "break-all"` breaks between any two letters, and
    `wordBreak: "keep-all"` doesn't break between CJK letters, as in CSS. Both
    used to break much as `normal` does.
  - `overflowWrap` (or the legacy `wordWrap`) is supported: `break-word` and
    `anywhere` break a word wider than its line between grapheme clusters, as
    the deprecated `wordBreak: "break-word"` does.
  - Emoji drawn as images sit as CSS `vertical-align: -0.1em` places a 1em
    image: their bottom 0.1em below the baseline, about where Chrome draws an
    emoji glyph. They used to sit in the middle of the line box, which put them
    below the text under a tall `lineHeight`.
  - `whiteSpace: "pre-wrap"` keeps the spaces before a line break in the line,
    as `pre` does.
  - `lineClamp` is rounded down to a whole number of lines.
  - A negative `lineHeight` is ignored, as CSS ignores it, and text with a
    `fontSize` of 0 has line boxes of no height.
  - `@effing/skia` is now 1.0.10-effing.3, and the `linebreak` dependency is
    dropped.

- ef08805: Collapse white space as CSS does

  Text under `whiteSpace: "normal"` (the default), `"nowrap"` and `"pre-line"`
  now has its white space processed as CSS Text 3 §4.1 has it, before
  `textTransform` applies:

  - A newline (or CRLF) becomes a space under `normal` and `nowrap`, so
    `"a\nb"` is one line, "a b", as in Chrome. `pre-line` keeps each newline as
    a line break.
  - Spaces and tabs around a newline are removed, tabs become spaces, and a run
    of spaces collapses to one.
  - Spaces at the start and end of the text are removed.

  Under every `whiteSpace` value, as in Chrome:

  - A newline that ends the text no longer starts an empty line.
  - A line or paragraph separator (U+2028, U+2029) is a space with a break
    opportunity after it, no longer a line break, and a form feed or vertical
    tab no longer breaks the line.

  `findLargestUsableFontSize` with `whiteSpace: "nowrap"` now fits the text on
  one line, newlines and all, as it's drawn, so text with newlines can get a
  smaller size than before; use `"pre"` to fit each newline-separated paragraph
  on a line of its own.

  Children are now laid out as the DOM has them: fragments, arrays and function
  components are unwrapped, so adjacent strings (as `Hello {name}` gives, or
  text across a fragment or component) are one run of text, and the content of
  a component that returns an array is no longer dropped. Each run of text
  between elements is a flex item of its own, as browsers lay out text in a flex
  container:

  - An empty or white-space-only run between elements no longer holds a line
    box, so `{" "}` between two elements no longer adds a line to a column or a
    `gap` to a row.
  - An element whose only text is empty or white space has no line box either:
    it's 0px tall unless its style gives it a size.
  - The leading white space after a `<br />` is removed by the general rule.

### Patch Changes

- d5b4fca: Detect emoji by grapheme, so flags are drawn and ZWJ text shapes

  - Flags such as 🇧🇪 are drawn as images; they used to be laid out as text.
  - A ZWJ between letters (`a‍b`, or the joiner in Arabic and Indic text) no
    longer turns the letter before it into an emoji box, so the text shapes as
    it should.
  - Symbols with no emoji form, such as `✓` and `●`, are text. So are `©`, `®`
    and `™` unless U+FE0F follows them, and digits, `#` and `*` unless a keycap
    follows them, as browsers draw them. Every other emoji character is drawn
    as an image, with or without U+FE0F (`❤`, `☎`, `🕵`); browsers draw
    text-default ones in the BMP such as `❤` as monochrome text through system
    font fallback, which canvas lacks.
  - Keycaps and `©️` load their images in the `openmoji`, `blobmoji` and `noto`
    styles, ZWJ sequences and keycaps in `fluent` and `fluentFlat`, and emoji
    typed without their U+FE0F (`🏳‍🌈`) in every style.

- 2c4b457: Keep emoji with their punctuation, and clamp lines as Chrome does

  `@effing/skia` is now 1.0.10-effing.4.

  - An emoji drawn as an image stays with the punctuation next to it, as in
    Chrome: `Hi 🎉! ok` breaks as `Hi | 🎉! | ok` where the "!" doesn't fit
    after the emoji, and `(🎉)` is never split.
  - A `lineClamp` line that ends at a newline under `whiteSpace: "pre-line"` or
    `"pre-wrap"` now ends in an ellipsis, as in Chrome (`"ab\ncd"` clamped to
    one line is "ab…"), and an empty clamped line is the ellipsis alone. Under
    `"pre"` such a line still has no ellipsis, where Chrome adds one.
  - The last line `lineClamp` shows is its own text with the ellipsis after it,
    cut by grapheme cluster until the two fit, as in Chrome: it no longer takes
    in the start of the next line's text ("ab cd…", not "ab cd e…"), and no
    longer keeps the space before the ellipsis ("aaaa bb…", not "aaaa bb …").
    `pre-wrap` keeps those spaces, as Chrome does.
  - Under `whiteSpace: "pre"` and `"pre-wrap"`, a CRLF is a newline and a lone
    CR is drawn as nothing, as in Chrome. A CR used to be drawn as a missing
    glyph's box, before the ellipsis of a clamped line too.

- 83e9b60: Size text boxes for the lines drawn in them.

  Yoga measures a text node at whatever widths its layout needs, and the text
  is drawn at the node's final width. When the two differed, a box could be a
  line taller or shorter than its text. Text is now laid out once more at its
  final width during layout, the node sized again where that changes its
  height, and the same layout drawn. Text squeezed to no width is also measured
  at that width, not as unbounded.

  Text boxes also keep the fractional width their text was measured at, where
  Yoga used to round them out to whole pixels, so text breaks where Chrome
  breaks it: three equal 98.33px columns wrap "Hello world" (98.93px) to two
  lines, as Chrome does, instead of drawing it on one line in a box sized for
  two. Text is still placed on whole pixels.

  `wordBreak: "break-word"` now breaks a word that is wider than its line, as
  in CSS, where it used to leave it overflowing like `normal`. `break-all`
  breaks such words wherever they are on a line (it missed one that followed
  other words), and still doesn't break between any two characters.

  A last word wider than its box overflows unbroken like any other, where it
  was broken mid-word. Empty text is laid out natively.

## 0.42.0

### Minor Changes

- 61e382f: Apply `opacity` and `filter` to an element and its descendants as one group,
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

- 61e382f: Render with `@effing/skia` instead of `@napi-rs/canvas`, and install it as a
  regular dependency instead of a peer.

  `@effing/skia` is Effing's fork of `@napi-rs/canvas`: the same API, plus the
  primitives the other changes in this release build on (unsnapped text, native
  paragraphs, compositing groups). Code that imports from `@effing/canvas` needs
  no change.

  The backend is no longer a peer dependency: `@effing/canvas` depends on
  `@effing/skia` at exactly `1.0.10-effing.2`, so it is installed with
  `@effing/canvas` and no project has to list it. A project that lists
  `@napi-rs/canvas` only to satisfy the old peer dependency can drop it.

  `@effing/skia` ships prebuilt binaries for Linux x64 and arm64 (glibc and musl),
  macOS x64 and arm64, and Windows x64. `@napi-rs/canvas`'s other targets (Linux
  armv7 and riscv64, Android, Windows ARM64) are no longer supported.

  `createCanvas().encode()` resolves with the backend's buffer as it is. It used
  to be copied to the JavaScript heap, a guard against lifetime bugs in
  `@napi-rs/canvas`'s asynchronous encode that `@effing/skia` does not have.

  `effing build` now leaves `@effing/canvas` out of the bundle instead of its
  backend, so the bundle loads the backend through `@effing/canvas`. A pnpm
  project used to have to list the backend itself for its bundle to start; it no
  longer does. The build also fails, naming the package, when the bundle imports
  one that Node would not find from where the bundle sits.

- 61e382f: Lay text out natively, as one paragraph that Skia breaks, shapes and paints.

  Text used to be wrapped in TypeScript by measuring it word by word, and each
  line drawn with its own `fillText` (one per character with `letterSpacing`).
  A text node is now a single `Paragraph` of `@effing/skia`: one native call
  lays it out, one paints it. On a 1080×1080 frame with a text card, a frame
  takes 0.8 ms where it took 1.0 ms, and a page of twelve paragraphs of 18px
  text 16 ms where it took 32 ms, even though glyphs are now filled as outlines.

  Line boxes follow the same CSS model as before (each exactly `lineHeight`
  tall, the baseline placed by half-leading from the font's hhea metrics), and
  in the test suite lines break where they did. What changes:

  - `textAlign: "justify"` now justifies wrapped lines; it used to left-align.
  - A centred or right-aligned line that is wider than its box now starts at the
    box's start edge and overflows its end, as in browsers; it used to stay
    centred or right-aligned across the box.
  - Line widths are no longer rounded to 1/100px.

  The TypeScript layout remains for what a paragraph can't express:
  `wordBreak: "break-all"`, emoji drawn as images, and a word wider than its
  box, which overflows unbroken as in CSS.

- 61e382f: Draw text unhinted and unsnapped, so it stays put while a scale animates.

  Glyphs used to be drawn as hinted masks snapped to the pixel grid, which
  places text up to half a pixel away from where its geometry puts it, by an
  amount that depends on the scale. To hide that, an element with a pure
  `scale()` transform was rendered into a supersampled offscreen buffer and
  composited back, which still made text jump when an animated scale crossed 1,
  2, 3, … and the buffer changed resolution.

  Text is now measured and filled as glyph outlines at their exact positions
  (`textRendering: "geometricPrecision"` on `@effing/skia`), and every element is
  drawn straight through its transform. Scaled text moves continuously with the
  rest of the element, and a frame renders the same at any output scale. Text
  pixels differ slightly from earlier versions: glyph edges are anti-aliased
  where they fall rather than aligned to the pixel grid.

### Patch Changes

- 1a2daea: Fix text wrapping pushing a word to the next line when it fits exactly (or with
  less than a space's width to spare). The wrapping check measured each candidate
  line including the space after its last word; trailing spaces now hang, as in
  CSS and satori, and no longer count toward whether a line fits.

## 0.41.1

### Patch Changes

- 83fe3b6: Fix scaled elements landing up to a pixel off from their unscaled position.

  A `scale()` transform renders the element's subtree into an offscreen buffer
  padded by a margin for overflowing ink, derived from the subtree's font sizes
  and box-shadows. When that margin was fractional (e.g. `fontSize: 13.01`), the
  buffer's whole-pixel size overshot the area it was composited back into, so the
  scaled content shrank by up to a pixel toward the element's top-left, and it
  was resampled off the pixel grid. An element animating from `scale(1)` to any
  other scale visibly jumped. The margin is now rounded up to whole pixels.

## 0.41.0

### Minor Changes

- 381fdc2: Add `clipPath` and `backdropFilter` support to `renderReactElement`.

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

### Patch Changes

- 2722e50: Require `@napi-rs/canvas` 1.0.9 or later.

  Earlier versions cached the typefaces Skia picked for each `ctx.font` (family
  list + weight + style) for the lifetime of the process and did not invalidate
  that cache when a font was registered
  ([Brooooooklyn/canvas#1329](https://github.com/Brooooooklyn/canvas/issues/1329)).
  Measuring or drawing text for a family or weight before its face was registered
  therefore pinned that lookup to the closest face available at the time — the
  fallback font, or e.g. the bold face for weight 400 — and later registrations,
  including the ones `renderReactElement` does for `options.fonts`, could not fix
  it. `@napi-rs/canvas` 1.0.9 invalidates the cache on registration
  ([Brooooooklyn/canvas#1334](https://github.com/Brooooooklyn/canvas/pull/1334));
  the peer range now requires it, and a regression test covers the
  registration-order scenarios.

## 0.40.2

### Patch Changes

- 103eee9: Re-export `Path2D`, `ImageData`, `DOMMatrix`, `DOMPoint`, `DOMRect`, `PathOp`,
  `FillType`, `StrokeJoin` and `StrokeCap` from `@napi-rs/canvas`.

  Previously only `Canvas`, `GlobalFonts`, `Image` and `LottieAnimation` were
  re-exported, so building a `Path2D` (for `ctx.fill(path)`, `ctx.clip(path)`,
  etc.) required importing from `@napi-rs/canvas` directly. Because
  `@napi-rs/canvas` is a peer dependency, that import fails under pnpm unless the
  consuming project also declares it as a direct dependency. All of these can now
  be imported from `@effing/canvas`, which also guarantees they come from the same
  native copy as the canvas context they are used with.

## 0.40.1

### Patch Changes

- cb8cb5d: Cap the @napi-rs/canvas peer range at the current major

  The peer range is now `^1.0.0` instead of `>=1.0.0`, so a future @napi-rs/canvas
  2.x is no longer accepted sight-unseen. Since @effing/canvas re-exports
  @napi-rs/canvas primitives and surfaces its types (SKRSContext2D, Image,
  LottieAnimation), an untested major could break consumers at runtime without any
  install-time warning; the range will be widened once a new major is verified.

## 0.40.0

## 0.39.0

### Minor Changes

- 30b49b4: Add `whiteSpace` option to `findLargestUsableFontSize` for single-line fitting

  `findLargestUsableFontSize` wraps text to `maxWidth` and fits it into the
  `maxWidth` × `maxHeight` box, so for a single-line use case it overshoots —
  a larger font is accepted by spilling onto more lines. The new `whiteSpace`
  option mirrors the CSS property (forwarded into the layout engine the same
  way `lineHeight` already is); pass `"nowrap"` (or `"pre"`) to fit the text on
  one line (per newline-separated paragraph), where `maxWidth` constrains the
  full line width. Defaults to `"normal"` (wrapping), so existing callers are
  unaffected.

## 0.38.4

## 0.38.3

### Patch Changes

- 9ea561d: Require `@napi-rs/canvas` 1.0.0

  Bump the `@napi-rs/canvas` peer dependency from `>=0.1.50` to `>=1.0.0`, adopting
  the now-stable 1.0 release of the underlying Skia bindings. Upstream reports no
  breaking API changes from the 0.1.x line, and the canvas comparison suite renders
  pixel-identical output, so this is a drop-in upgrade for the rendering path —
  consumers just need to provide `@napi-rs/canvas@^1` going forward.

- fff6f4b: Stop a CSS transform from clipping an element's own painting

  The pure-scale offscreen path rasterized the subtree into a buffer sized to the
  layout box (plus 1px) and hard-clipped to it, so any ink that legitimately
  overflows the box — a trailing glyph pushed past the edge by negative
  letter-spacing, italic overhang, glyph side bearings — was sliced off on every
  transformed frame. The same element painted the overflow correctly without a
  transform.

  The offscreen buffer is now grown by the subtree's estimated ink/shadow
  overflow (glyph overhang ≈ one em, plus any negative letter-spacing, plus
  box-shadow extent) on every side, so transformed content keeps the overflow the
  untransformed element would paint. Per the CSS spec, a transform never clips an
  element's own content.

## 0.38.2

## 0.38.1

## 0.38.0

### Minor Changes

- d199dbc: Add `options.imageCache` to `renderReactElement` for persistent image caching

  By default each `renderReactElement` call creates a fresh image cache, so
  every `<img>` / `background-image: url(...)` source is re-fetched and
  re-decoded per call — a silent performance cliff when rendering per frame.
  Callers can now pass a persistent cache (`new Map()`, exported type
  `ImageCache`) so each source is loaded once, on first use. Sharing one cache
  across concurrent calls is safe: entries are load promises, so concurrent
  renders share a single in-flight fetch. `cachedLoadImage` now also evicts
  failed loads instead of caching the rejection, so a transient network error
  no longer poisons a long-lived cache. The manual's "Creating Annies" section
  documents the option as the simplest fix for per-frame image fetching.

### Patch Changes

- d199dbc: Document that renderReactElement re-fetches image sources on every call

  `renderReactElement` creates a fresh internal image cache per call, so `<img>`
  and `background-image: url(...)` sources in a per-frame tree are re-fetched and
  re-decoded on every frame — a silent ~24× slowdown in a measured case. The
  manual's "Creating Annies" section now warns about this and shows the
  load-once pattern (pre-load with `loadImage()`, draw with `ctx.drawImage`,
  keep the per-frame React tree to text and vectors); the `@effing/canvas`
  README carries the same warning next to `renderReactElement`.

- 6cd7ae3: Honor gradientUnits="userSpaceOnUse" on SVG gradients

  Gradient coordinates were always interpreted as objectBoundingBox fractions,
  so gradients with userSpaceOnUse units (as emitted by Figma and Illustrator
  exports) clamped to the first stop and rendered as a flat color. Linear and
  radial gradients now use user-space coordinates directly for both fills and
  strokes, with percentages resolved against the viewport per the SVG spec.

## 0.37.1

## 0.37.0

### Patch Changes

- d8f961d: Document that `align-items: baseline` / `align-self: baseline` is not true baseline alignment

  `baseline` was listed as a supported `alignItems` / `alignSelf` value, but the
  bundled Yoga layout engine's JS binding exposes no baseline function, so it
  aligns children to the line-box bottom (the same result as `flex-end`) rather
  than to the typographic baseline. Rows mixing different font sizes do not share
  a text baseline. The README now states this limitation explicitly (the same
  caveat applies to Satori, from which the layout engine is derived); behavior is
  unchanged.

- 63d3545: Unwrap React fragments inside SVG subtrees

  Fragments inside `<svg>` previously kept their `Symbol(react.fragment)` type
  through layout, so the SVG drawer silently skipped them and fragment-rooted
  icons rendered as empty. Fragments are now unwrapped during SVG tree
  resolution, so their children draw (and resolve `currentColor`) as if placed
  directly in the parent element.

## 0.36.2

## 0.36.1

## 0.36.0

### Minor Changes

- d779d51: Add a userAgent option for remote image fetches

  `renderReactElement` gains a `userAgent` option that sets the User-Agent header
  on remote (`http`/`https`) `<img>` and `background-image: url(...)` fetches. The
  public `loadImage` is now a thin wrapper that routes remote URLs through the same
  global `fetch()` path as `<img>` sources — so a global dispatcher / proxy and the
  new `userAgent` option are honored, and `loadImage(url)` and `<img src={url}>`
  behave consistently — while non-remote sources still delegate to
  `@napi-rs/canvas`'s native loader. Images that fail to load during layout are now
  reported via `console.warn` when the `debug` option is enabled instead of failing
  silently.

## 0.35.3

### Patch Changes

- d541d0a: Document inline SVG support in JSX

## 0.35.2

## 0.35.1

## 0.35.0

## 0.34.0

## 0.33.1

## 0.33.0

### Minor Changes

- 4ed502b: Support `backgroundRepeat` and decompose the `background` shorthand

  Add `backgroundRepeat` support for `backgroundImage: url(...)` layers, with
  `repeat` (default), `no-repeat`, `repeat-x`, and `repeat-y`. Previously the
  renderer always tiled in both directions.

  Also expand the `background` shorthand into its longhand parts
  (`backgroundColor`, `backgroundImage`, `backgroundRepeat`, `backgroundSize`)
  so values like `background: #eee url(foo.png) no-repeat center / cover` are
  now decomposed correctly. Position, attachment, and `<box>` keywords are
  recognized but currently dropped (the renderer doesn't honor them yet).

## 0.32.0

## 0.31.4

## 0.31.3

### Patch Changes

- 14a9b2a: Fix function components and array helpers inside `<svg>`

  Function components nested inside an `<svg>` element are now expanded (previously they were silently dropped because the SVG drawer only matched primitive element strings). Helpers that return arrays of SVG children no longer crash the defs collector — nested arrays are flattened during the layout pass.

## 0.31.2

## 0.31.1

## 0.31.0

## 0.30.2

### Patch Changes

- 67021d9: Fix clipping of transformed content when `transform` combines `scale(...)` with `translate(...)` and/or `rotate(...)`

  The scale path renders to a layout-box-sized offscreen and composites it back scaled, which keeps glyphs sharp under repeated rasterization. When the transform also contained a translate or rotate, that secondary transform was applied inside the offscreen — so any drawing it pushed beyond the layout box was clipped by the offscreen's bounds (and the destination rect on the main canvas wouldn't have covered it anyway). Mixed transforms now bypass the offscreen path and render directly to the main context with the full transform applied. Pure-scale transforms still go through the offscreen for crispness.

## 0.30.1

## 0.30.0

## 0.29.1

### Patch Changes

- 55f14a5: Fetch remote images via global `fetch()` instead of `@napi-rs/canvas`'s URL loader

  `cachedLoadImage` now downloads `http://` and `https://` sources with the global
  `fetch()` and passes the resulting bytes to `loadImage`. `@napi-rs/canvas`'s
  built-in URL loader uses Node's raw `http`/`https` modules, which bypass any
  dispatcher installed via `setGlobalDispatcher` — so consumers that route
  outbound traffic through a proxy (e.g. the sandboxed runtime in `effing-cloud`)
  could not load remote images. Non-OK responses now throw an error naming the
  URL and status. File-path strings and `Buffer` sources are unaffected.

## 0.29.0

## 0.28.0

## 0.27.0

## 0.26.1

### Patch Changes

- 64c9b1f: Change license from O'Saasy to MIT

## 0.26.0

### Minor Changes

- 619bcf7: Make fonts optional in renderReactElement

  The `fonts` option and the entire `options` parameter are now optional. When no
  fonts are provided, text renders using system fonts with a default family of
  Helvetica, Arial, sans-serif — chosen so @napi-rs/canvas resolves real font
  metrics instead of generic ratios.

## 0.25.1

## 0.25.0

### Patch Changes

- 05bb661: Fix boxShadow being clipped by the element's own overflow:hidden

  CSS overflow:hidden clips children, not the element's own box-shadow. The shadow
  is now drawn before the overflow clip is applied, matching browser and satori
  behavior.

## 0.24.8

### Patch Changes

- b095865: Use hhea font metrics for text baseline positioning to match Satori

  Baseline positioning now uses hhea-derived ascent/descent instead of canvas
  `fontBoundingBoxAscent/Descent`. For fonts where these values diverge (e.g.
  fonts with USE_TYPO_METRICS set and differing hhea vs sTypo ascenders), this
  aligns our baseline calculation with Satori's. Also extracts a shared
  `fontMetricsToPx` helper to eliminate duplicated hhea-to-pixel conversion.

## 0.24.7

### Patch Changes

- 57d6130: Handle comma-separated font-family in getFontMetrics

  `getFontMetrics` previously matched against the full CSS `font-family` string
  (e.g. `"CentraNo1, Liberation Sans"`), which never matched cache keys stored
  under individual family names. It now splits on commas and tries each name,
  so hhea metrics are correctly resolved for fonts used with fallback chains.

- ad5684d: Support WOFF font metric parsing in `parseFontMetrics`

  Previously `parseFontMetrics` only handled TrueType/OpenType (`.ttf`/`.otf`)
  table directories, silently returning `null` for WOFF files. This meant
  `line-height: normal` fell back to canvas-measured metrics instead of using the
  hhea ascender/descender values from the font. The function now detects the WOFF
  signature, parses the WOFF table directory, and decompresses tables with zlib
  when needed.

## 0.24.6

### Patch Changes

- f4a9717: Rewrite text shadow rendering to match CSS behavior

  Replaces the canvas shadow API with manual shadow drawing. The old approach had
  two issues: (1) `drawTextShadow` called `fillText` to trigger the shadow, then
  callers called `fillText` again — double-painting text with alpha colors, and
  (2) the canvas shadow API renders shadows at full specified opacity regardless of
  text color alpha, while CSS text-shadow scales shadow opacity by the text's alpha.
  Also fixes textShadow being silently ignored on text with letterSpacing.

- 0f82a09: Use hhea table metrics for line-height: normal instead of OS/2 sTypo metrics

  The previous implementation used OS/2 sTypoAscender/sTypoDescender/sTypoLineGap to compute
  `line-height: normal`, which produced taller line heights than Chrome (macOS) and Satori.
  Now uses hhea ascender/descender with no line gap, matching their behavior.

## 0.24.5

### Patch Changes

- dc3bac7: Match Satori's `<img>` dimension derivation when no dimensions are set

  When an `<img>` has neither width nor height, set `width: "100%"` and use
  `setAspectRatio()` so the image fills its parent container, matching Satori's
  behavior. Previously we fell back to natural pixel dimensions, causing layout
  divergence.

## 0.24.4

### Patch Changes

- 4f1b05b: Fall back to natural image dimensions when no width or height is set

  Images with no explicit dimensions could collapse to 0x0 because
  `setAspectRatio()` alone gives Yoga a ratio but no concrete dimension to derive
  from. Now the natural pixel size is used as the default, matching browser
  `<img>` behavior.

## 0.24.3

### Patch Changes

- 9725c49: Use Yoga `setAspectRatio()` for `<img>` dimension derivation

  Previously, the missing dimension was only derived when the set dimension was a
  numeric pixel value. Percentage-based dimensions (e.g. `width="100%"`) and images
  with no explicit dimensions did not preserve the intrinsic aspect ratio. Using
  Yoga's native `setAspectRatio()` handles all cases uniformly.

## 0.24.2

### Patch Changes

- f1a2bfe: Inherit textShadow to child text nodes

## 0.24.1

### Patch Changes

- f03823c: Fix textShadow regex failing on unitless zero values

## 0.24.0

### Minor Changes

- ea8d380: Add `findLargestUsableFontSize` for fitting text to a bounding box

  Binary searches over integer font sizes using the built-in text layout engine to
  find the largest size that keeps text within the given width and height. Supports
  configurable line height, min/max font size bounds, and reuses the existing
  `FontData` type.

## 0.23.2

### Patch Changes

- bb47741: Ceil text node height to prevent Yoga integer rounding from clipping descenders

  When auto line-height produces a fractional totalHeight (e.g. 15.52), Yoga's
  integer rounding (pointScaleFactor=1) could round it down, clipping glyph
  descenders like "g". Applying Math.ceil to totalHeight inside the auto
  line-height block adds at most 1px, ensuring descenders are never cut off.

- dbe77e2: Remove `@effing/satori` package and update all references to use `@effing/canvas`

  The satori package has been fully replaced by the canvas package's built-in JSX
  rendering. All documentation, code examples, and cross-references now point to
  `@effing/canvas` instead. The comparison test in canvas inlines emoji loading
  rather than importing from the removed satori package.

## 0.23.1

### Patch Changes

- b60e0a7: Use canvas-measured ascent/descent for text baseline positioning instead of sTypo font metrics

## 0.23.0

### Minor Changes

- fc2d4f1: Add WebkitTextStroke support for text stroke effects

  Support `WebkitTextStroke`, `WebkitTextStrokeWidth`, and `WebkitTextStrokeColor`
  CSS properties. The shorthand is expanded into width and color longhands, both
  properties inherit like `color`, and stroke is drawn before fill (paint-order:
  stroke) using `ctx.strokeText()` with round line joins.

### Patch Changes

- e72e963: Collapse leading whitespace after `<br />` per CSS Text 3 §4.1.1

## 0.22.3

### Patch Changes

- 9881cea: Use font typographic metrics for `line-height: normal` instead of canvas bounding box

  Parse `sTypoAscender`, `sTypoDescender`, and `sTypoLineGap` from the font's OS/2
  table at registration time and use them to compute `line-height: normal` per the
  CSS spec. This fixes vertical text positioning in flex containers with
  `alignItems: "center"` to match Satori's output.

## 0.22.2

### Patch Changes

- 87fd979: Use ctx.reset() in offscreen canvas pool to fully reset context state

  Replaces manual setTransform + clearRect with ctx.reset() when reusing pooled
  canvases. This prevents leaking styles, clipping regions, and saved state from
  previous consumers.

- d14d923: Resolve viewport-relative units on SVG width/height and apply opacity on `<g>` and shape elements

  SVG elements with viewport-relative units like `width="25vw"` previously resolved to NaN and rendered nothing. The width/height merging now uses `resolveUnit` to handle vw, vh, vmin, vmax, em, rem, etc.

  The `opacity` property on `<g>` elements was silently ignored. It is now applied via `globalAlpha`, and the same treatment is applied to individual shape elements (`<path>`, `<rect>`, etc.) for consistency.

## 0.22.1

### Patch Changes

- d226951: Handle all CSS color formats in SVG fillOpacity/strokeOpacity
- 5b5183a: Inherit SVG stroke properties from parent `<g>` elements

  Stroke attributes (stroke, strokeWidth, strokeLinecap, strokeLinejoin,
  strokeOpacity) set on `<g>` elements now propagate to child shapes, matching
  SVG spec inheritance behavior. Previously only fill was inherited, causing
  stroke-only children to be invisible.

## 0.22.0

### Minor Changes

- a892d9f: Add SVG filter effects support to canvas renderer

  The canvas renderer now processes SVG `<filter>` definitions and applies filter
  primitives (`feOffset`, `feGaussianBlur`, `feColorMatrix`, `feBlend`) during
  rasterization. Filter pipelines use offscreen canvases and named buffers,
  following the same pattern as mask support. This enables rendering of common
  SVG effects like drop shadows.

### Patch Changes

- 72d575d: Collect SVG definition elements (mask, clipPath, filter, gradients) as direct children of `<svg>`, not only inside `<defs>`
- 97db116: Default text-only flex items to flexShrink 1 to match satori

  Text containers without an explicit flexShrink now shrink to fit their
  available flex space instead of overflowing. Also handle `flex: "none"`
  explicitly in style expansion.

- 7914638: Inset image content area by border width so borders on img elements are visible
- cd317ce: Skip flexGrow on implicit text children when justifyContent is non-default

  When a flex container has `justifyContent: "center"` (or other non-default
  values), the implicit text child no longer gets `flexGrow: 1`, allowing yoga to
  position it correctly instead of stretching it to fill the parent.

- c1ba8cc: Apply fillOpacity and strokeOpacity on SVG child elements
- 968710d: Apply transform attribute on SVG shape elements

## 0.21.1

### Patch Changes

- b2d607f: Support borderRadius on per-side borders

  Individual borders (different widths/colors per side) now draw rounded corner
  arcs instead of straight lines when borderRadius is set. Each corner arc is
  assigned to exactly one side to avoid double-stroking anti-aliasing artifacts.

- a4e0548: Flatten array children instead of wrapping them in implicit div nodes

  When JSX children included arrays (from `.map()`, `Array.from()`, etc.),
  `buildNode` wrapped them in a synthetic `<div>` with its own yoga node, breaking
  flex layout because the parent saw fewer children than expected. Arrays are now
  flattened into the parent's child list, matching React/browser behavior.

## 0.21.0

## 0.20.1

### Patch Changes

- 444bb48: Add SVG `<rect rx>` rounded corners and `<mask>` support

  The canvas renderer now correctly handles `rx`/`ry` attributes on SVG `<rect>`
  elements, rendering rounded corners via `Path2D.roundRect()`. Previously these
  attributes were ignored and all rects rendered with sharp corners. Additionally,
  SVG `<mask>` definitions are now collected and applied via offscreen canvas
  compositing with `destination-in`, matching browser rendering behavior.

## 0.20.0

### Minor Changes

- b97fe30: Add lineClamp support to canvas renderer

  The canvas renderer now supports the `lineClamp` CSS property, which truncates
  text to a maximum number of visible lines and appends an ellipsis. Also fixes an
  off-by-one in `truncateWithEllipsis` that could leave one character of headroom
  unused.

- f0673c1: Add width/height override options to renderReactElement

  Layout dimensions now default to `ctx.canvas.width` / `ctx.canvas.height` but
  can be overridden via optional `width` and `height` fields in
  `RenderReactElementOptions`. This enables the standard HiDPI canvas pattern
  (oversized canvas + `ctx.scale(dpr, dpr)`) without layout happening at the
  physical pixel size.

## 0.19.3

### Patch Changes

- cbd1ff4: Clean up draw system and make comparison tests work offline

  Deduplicate drawNode/drawNodeInner into a single drawNodeCore function, extract
  shared CSS utilities to draw/utils.ts, reuse the existing hasRadius helper, and
  consolidate redundant getBorderRadius wrappers. Comparison tests now fall back to
  local Liberation Sans fonts and skip emoji tests when the network is unavailable.

## 0.19.2

### Patch Changes

- 34b2c1b: Wrap root element in a canvas-sized container node during layout

  The layout tree now always wraps the user's root element in a container node
  sized to the canvas dimensions, matching how Satori handles root layout. This
  fixes `position: absolute` on root elements where `top/left/right/bottom` edges
  were ignored because the root node's width/height were overridden to the full
  canvas size after styles were applied.

## 0.19.1

### Patch Changes

- aeea9e5: Fix percentage unit handling across layout and drawing pipeline

  Percentage strings like `width="100%"` on `<svg>` and `<img>` elements were
  silently dropped during viewBox/aspect-ratio derivation, causing the numeric
  part to be treated as pixels. SVG child shapes with percentage attributes
  (e.g. `<rect width="50%">`) produced NaN via `Number()`. Percentage padding
  and border-width values were also silently stripped by `parseFloat()`.

## 0.19.0

### Minor Changes

- f8445d9: Support `text-box-trim` and `text-box-edge` CSS properties

  Add support for trimming half-leading from text line boxes via `textBoxTrim`,
  `textBoxEdge`, and the `textBox` shorthand. Maps CSS text-edge keywords (`cap`,
  `ex`, `alphabetic`, `text`, `ideographic`) to canvas font metrics for precise
  typographic control.

### Patch Changes

- 7564446: Stop `clipRule` from clipping the canvas on regular SVG elements
- 62aaef6: Support per-side border shorthands (`borderLeft`, `borderRight`, `borderTop`, `borderBottom`)
- b71f485: Resolve CSS units in `fontSize` and `letterSpacing` during style resolution

  `fontSize: "4em"`, `"2rem"`, `"24px"` etc. are now resolved to pixel values in
  `resolveStyle`, so downstream consumers always see a number. Introduces
  `ExpandedStyle` to type the pre-resolution stage cleanly, keeping
  `ComputedStyle.fontSize` strictly `number`.

- 0e5c8f0: Add SVG gradient fill and stroke support to canvas renderer

  The canvas renderer now processes `<linearGradient>` and `<radialGradient>`
  definitions from SVG `<defs>`, applying gradient fills and strokes to shape
  elements via `url(#id)` references.

- 6651605: Support SVG `transform` attribute on `<g>` elements in canvas renderer

## 0.18.6

### Patch Changes

- cf3b58a: Fix special character rendering (`€`, `²`, accented letters) by building a font fallback chain from all provided fonts and quoting multi-word family names in the CSS font shorthand passed to `@napi-rs/canvas`.
- c135efa: Generalize CSS unit resolution in `transform` and `transformOrigin` strings. Units like `vw`, `vh`, `em`, `rem`, `px`, `pt`, etc. are now resolved to pixel values at layout time instead of being silently dropped by `parseFloat()` at draw time.
- cd75f46: Support SVG `<clipPath>` definitions in the canvas renderer. `<clipPath>` elements inside `<defs>` were silently skipped, and `clip-path="url(#id)"` attributes on elements were never resolved. The renderer now collects `<clipPath>` definitions in a first pass, builds a combined `Path2D` from their child shapes, and applies `ctx.clip()` before drawing elements that reference them.
- c8779d5: Resolve percentage values in CSS `translate()` transforms against the element's own dimensions. `translate(-50%, -50%)` now correctly shifts by half the element's width/height instead of being interpreted as pixels.

## 0.18.5

### Patch Changes

- 5cb25b8: Fix CSS units being silently stripped in shorthand expansion (`margin`, `padding`, `borderRadius`, `gap`, etc.). `parseValue()` now uses `Number()` instead of `parseFloat()`, preserving unit strings like `"50%"`, `"2em"`, `"10px"` for downstream resolution. Border-radius properties are also added to `DIMENSION_PROPS` so `resolveUnits()` handles `em`/`rem`/`vw`/etc. on them.
- 0198a76: Fix rendering of multiple layered CSS background gradients on React elements (e.g. `backgroundImage: "linear-gradient(...), linear-gradient(...)"`). The full multi-layer string was passed as-is to the gradient parser, whose greedy regex captured across both gradients and produced corrupted color stops. Now `backgroundImage` is split into individual layers using paren-depth-aware comma splitting, and each layer is rendered bottom-to-top per CSS stacking order.
- a187432: Fix `letterSpacing` being ignored when `emojiStyle` is active (the default). `drawSegmentWithEmoji` now draws text runs character-by-character with spacing and accounts for letter spacing in run positioning via `splitTextIntoRuns`.
- 8a29c96: Fix SVG `fillRule="evenodd"` not being applied. Compound paths with holes (e.g. a map pin with a circular cutout) were rendered solid because `ctx.fill()` defaulted to `"nonzero"`. The fill rule and clip rule are now read from element props and forwarded to the Canvas 2D API.

## 0.18.4

### Patch Changes

- eb5c6d1: Fix `<img>` and `<svg>` elements with percentage `width`/`height` HTML attributes (e.g. `<img width="100%" height="100%">`) collapsing to 0×0. Percentage strings are now preserved instead of being coerced through `Number()` which produced `NaN`.
- 1dbc177: Fix `currentColor` in SVG `fill` and `stroke` attributes. The literal string was passed straight through to the canvas 2D API which doesn't understand it. It is now resolved to the inherited CSS `color` value.
- 6c7953a: Fix `textAlign: "center"` (and `"right"`) on divs. The text child yoga node now sets `flexGrow: 1` and `flexShrink: 1` so it fills the parent's width, giving `layoutText` the full container width to calculate alignment offsets against.

## 0.18.3

### Patch Changes

- c5de3aa: Fix `<img>` elements with positional sizing (e.g. `position: absolute` with `top`/`left`/`right`/`bottom`) collapsing when no explicit `width`/`height` is set. Natural dimensions are no longer forced onto the style — only a missing dimension is derived when exactly one is provided.

## 0.18.2

### Patch Changes

- 35c8a2c: Intrinsic auto-sizing for `<img>` elements. When only one of `width`/`height` is specified (or neither), the missing dimension is now derived from the image's natural aspect ratio — matching browser behavior. Images are loaded during layout and cached to avoid a redundant load at draw time.
- a75e320: Support SVG presentation attributes set via the `style` prop (e.g. `style={{ fill: 'blue' }}`). Style values take precedence over direct props, matching browser CSS specificity rules.

## 0.18.1

### Patch Changes

- 8718e68: Support CSS viewport and absolute units (`vw`, `vh`, `vmin`, `vmax`, `em`, `rem`, `px`, `pt`, `pc`, `in`, `cm`, `mm`) in style dimensions, resolving them to pixels during layout.
- 63a015d: Support hyphenated SVG stroke attributes (`stroke-width`, `stroke-linecap`, `stroke-linejoin`) that React preserves as string-keyed props from JSX.
- 7cb4a47: Fix blurry output when using scale transforms by rendering offscreen buffers at quantized resolution (ceil of absolute scale value). The buffer resolution only changes at integer boundaries, eliminating jitter, and the composite is always a downscale, producing sharp output.

## 0.18.0

### Minor Changes

- bb59987: Introduce `@effing/canvas` — server-side canvas with JSX and Lottie support. Provides `renderReactElement()` for JSX-to-canvas rendering with Yoga flex layout, emoji support, and font management, plus `loadLottie()` / `renderLottieFrame()` for Lottie animation frames.

### Patch Changes

- 0bd4786: Fix SVG elements with a `viewBox` but only one of `width`/`height` specified rendering as invisible. The missing dimension is now derived from the viewBox aspect ratio.
