# Comparison tests

`pnpm --filter @effing/canvas test:comparison` renders JSX with canvas and checks it against a reference. There are three kinds of reference:

- **Chrome's layout and pixels, generated.** `chrome-references.test.tsx` checks canvas against what headless Chrome makes of the same fixtures, recorded in `chrome/references/` by `chrome/generate.tsx`. This is the reference to use for text and layout.
- **Chrome's numbers, copied by hand.** `native-text`, `white-space`, `br`, `min-content` and part of `image` hold line texts, positions, widths and line boxes that were copied from headless Chrome 154 on macOS before the generator existed. Most of them are ported to fixtures in `chrome/fixtures/`, whose `transcribed` values check the generated references against the copied numbers; native-text's Thai, Lao and Burmese lines are not ported yet.
- **Satori, as a smoke check.** `cards`, `layout`, `text`, `image`, `emoji`, `svg-*`, `clip-path` and a few `native-text` cases compare canvas's pixels with Satori's (through resvg), with a tolerance on the share of pixels that differ. Satori is a poor reference for text (no `line-height: normal` line gap, its own line breaking), so these catch regressions more than they prove CSS behaviour.
- **Invariants.** Other tests hold no reference but properties that must hold: `groups`, `transform-clip` and `backdrop-filter` check pixels where an effect must or mustn't paint, `font-registration` checks fonts registered late, and parts of `native-text` check that text is measured and drawn at the same width.

Set `COMPARISON_DEBUG=1` to write each pixel comparison's images and diff to `$TMPDIR/effing-comparison-debug/`.

## Chrome references

Each fixture is a React element, rendered by canvas as it is and by Chrome as its `renderToStaticMarkup` markup, so the test and its reference can't drift: each reference stores a hash of the markup it was made from, and the test fails when the fixture has changed since.

The generator lays each fixture out in a frame of the fixture's size, with canvas's defaults where CSS has others: every element a `display: flex` row in `border-box` sizing and `position: relative`, with no margins, padding or browser styles of its own; `flex-shrink: 0` unless set, except on an element of nothing but text; `lineClamp` as `-webkit-line-clamp` (on an element of text and `<br>`s only: the generator refuses one on an element with elements in it, which a `-webkit-box` would stack); `textOverflow`, `textBoxTrim` and `textBoxEdge` inherited, and an element of nothing but text with them a block container, where they apply. It uses the fonts in `_helpers/fonts/`, as web fonts. It records, for every element with an `id`:

- its border box (`x`, `y`, `width`, `height`, relative to the frame);
- the lines of all its text, in document order: the text drawn on each line, where it starts and how wide it is (from `Range.getClientRects` over each grapheme cluster), the line box and baseline of a line of its own font there (`top`, `height`, `baseline`). White space that collapsed is left out, and so are the spaces that hang at a soft wrap. A line Chrome ends in an ellipsis is marked `truncated`, but its text and width are the whole line's: Chrome doesn't say where it cut it.

The line box is measured on a line of just the text's own font, off the page, as the DOM has no way to measure the line box of a line of text in a flex item without changing its layout. It is the real one wherever the line holds nothing taller: a line with a glyph from a fallback font (Chrome draws `\f` and `\v` in one) or an inline image can be taller in Chrome, which only its element's box then shows.

For a fixture with `screenshot: true`, it also stores a PNG of the frame (on a transparent page), which the test compares with canvas's pixels. In a screenshot, the ink of each `truncated` line must end where Chrome's does, to 1px: that is where the ellipsis ends, which the share of pixels that differ is too coarse to pin.

`chrome-references.test.tsx` then checks, without Chrome:

- that every fixture has a reference, made from its markup as it is, by the generator as it is (a hash of `generate.tsx`, `page.css`, `measure.browser.js` and the fonts), on macOS;
- that the references hold the `transcribed` numbers to 0.01px, and the `transcribedPixels`;
- that canvas lays each fixture out as Chrome did, within the fixture's tolerance (`DEFAULT_TOLERANCE` in `chrome/fixture.ts`: 1px for boxes and the start and top of a line, as Yoga puts boxes on whole pixels; 0.1px for a line's width; 0.01px for line boxes and baselines; 1% of pixels at pixelmatch's 0.1 threshold for screenshots). Texts are compared without trailing spaces or control characters. A truncated line must start as Chrome's does, end in its element's box, and, where Chrome's line fits the box, keep all of it but its last word.

A fixture with a `knownDifference` documents where canvas doesn't lay it out as Chrome does: why (with the issue to fix it), and what differs, as the subjects of the differences found (`"#p line 1 width"`) or RegExps of them. The differences found must be those, and no others, and the test fails once there are none, so that the note goes when the difference does. A `knownPaintDifference` does the same for a fixture that canvas lays out as Chrome does but paints otherwise: the share of its pixels that differ must be within the range measured (beyond its tolerance), and the ellipses that end elsewhere than Chrome's those it names.

Chrome is a reference for correctness, not a target: matching it isn't a goal in itself. A difference that is kept on purpose, whose issue was closed without a change, says so with `intentional(issue, why)` from `chrome/fixture.ts`, and isn't a bug to fix.

### Regenerating

```sh
pnpm --filter @effing/canvas comparison:chrome            # every module
pnpm --filter @effing/canvas comparison:chrome br painting # some
```

It drives the Chrome installed on the machine through `playwright-core` (no browser download), from `CHROME_PATH` or the usual install location, and records Chrome's version and the platform in each JSON file. Commit the JSON and PNG files it writes; CI has no Chrome and only reads them. The Chrome version recorded can differ from module to module, as each module is regenerated on its own: only the generator hash and the platform are checked.

Generate them on macOS. Chrome rounds `line-height: normal` line boxes differently on Linux, and canvas sizes them as Chrome on macOS does (see footnote ⁴ in the [canvas README](../README.md)); text is also rasterised differently across platforms, so screenshots taken elsewhere won't match canvas as closely. Fonts that aren't in `_helpers/fonts/` (emoji, CJK, a glyph a font doesn't have) come from the system in Chrome and differ from canvas's: keep fixtures to the bundled fonts, or give them a tolerance and say why.

Fixtures set their text in `SANS` (from `chrome/fixture.ts`): the bundled Liberation Sans under a family name no system font has, so that they can't pick up a Liberation Sans installed on the system, as Ubuntu's fonts-liberation is on CI, which kerns differently. (Since @effing/skia 1.0.10-effing.6, a font registered under a system family's name replaces that family, so it no longer would: [effing-skia#29](https://github.com/builtbyfew/effing-skia/issues/29).)

### Adding a fixture

1. Add it to a module in `chrome/fixtures/` (or a new module, listed in `chrome/fixtures/index.ts`):

   ```tsx
   paragraph("justifies the lines", TEXT, { textAlign: "justify" }, 200),
   {
     name: "a box with a shadow",
     width: 200,
     height: 100,
     screenshot: true,
     element: (
       <div style={{ display: "flex", padding: 20, backgroundColor: "white" }}>
         <div id="box" style={{ width: 100, height: 40, boxShadow: "4px 4px 8px red" }} />
       </div>
     ),
   },
   ```

   Give every element whose box or lines should be compared an `id`. `paragraph()` puts text in a box of its own width, as `layoutText` lays it out. Set the font to `SANS`: canvas defaults to Helvetica, which Chrome has as a system font.

2. Run `pnpm --filter @effing/canvas comparison:chrome <module>`, look at what Chrome made of it (the JSON, the PNG), and run `pnpm --filter @effing/canvas test:comparison`.
3. Where canvas differs, fix canvas, or set a `tolerance` or a `knownDifference` (`knownPaintDifference` where only its pixels differ) with the reason. A tolerance for pixels is what canvas was measured to differ by, with room to spare, and says why it differs: text, for one, is rasterised heavier by Chrome on macOS, and differs most where it's small and on a frame cut to it.

Write fixtures so that CSS and canvas read them alike:

- Give line heights in px (`"30px"`): a number is a multiple of the font size in CSS, but px above 5 in canvas. The generator refuses one.
- Align text in a box with `flexDirection: "column"` on the box. This is a deliberate difference between canvas and CSS (decided in effing#196: canvas keeps it): in a row, canvas grows the text of an element of nothing but text across the element (where its `justifyContent` is `flex-start`, the default), so `textAlign` aligns it there, where CSS leaves the text's anonymous flex item as wide as its text, with nothing to align it in. Across a column, both stretch it ([effing#196](https://github.com/builtbyfew/effing/issues/196)).
- Set `flexShrink` where an item should shrink: canvas defaults it to 0 (as Satori does), except for an element of nothing but text; the generator sets it the same way.
- `text-overflow: ellipsis` needs `overflow: hidden` in Chrome.
