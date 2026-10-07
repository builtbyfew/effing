# Comparison tests

`pnpm --filter @effing/canvas test:comparison` renders JSX with canvas and checks it against a reference. There are three kinds of reference:

- **Chrome's layout and pixels, generated.** `chrome-references.test.tsx` checks canvas against what headless Chrome makes of the same fixtures, recorded in `chrome/references/` by `chrome/generate.tsx`. This is the reference to use for text and layout.
- **Chrome's numbers, copied by hand.** `native-text`, `white-space`, `br`, `min-content` and part of `image` hold line texts, positions, widths and line boxes that were copied from headless Chrome 154 on macOS before the generator existed. Most of them are ported to fixtures in `chrome/fixtures/`, whose `transcribed` values check the generated references against the copied numbers; native-text's Thai, Lao and Burmese lines, its multi-line clamps and its painted ellipsis are not ported yet.
- **Satori, as a smoke check.** `cards`, `layout`, `text`, `image`, `emoji`, `svg-*`, `clip-path` and a few `native-text` cases compare canvas's pixels with Satori's (through resvg), with a tolerance on the share of pixels that differ. Satori is a poor reference for text (no `line-height: normal` line gap, its own line breaking), so these catch regressions more than they prove CSS behaviour.
- **Invariants.** Other tests hold no reference but properties that must hold: `groups`, `transform-clip` and `backdrop-filter` check pixels where an effect must or mustn't paint, `font-registration` checks fonts registered late, and parts of `native-text` check that text is measured and drawn at the same width.

Set `COMPARISON_DEBUG=1` to write each pixel comparison's images and diff to `$TMPDIR/effing-comparison-debug/`.

## Chrome references

Each fixture is a React element, rendered by canvas as it is and by Chrome as its `renderToStaticMarkup` markup, so the test and its reference can't drift: each reference stores a hash of the markup it was made from, and the test fails when the fixture has changed since.

The generator lays each fixture out in a frame of the fixture's size, with canvas's defaults where CSS has others: every element a `display: flex` row in `border-box` sizing and `position: relative`, with no margins, padding or browser styles of its own; `flex-shrink: 0` unless set, except on an element of nothing but text; `lineClamp` as `-webkit-line-clamp`; `textBoxTrim` inherited. It uses the fonts in `_helpers/fonts/`, as web fonts. It records, for every element with an `id`:

- its border box (`x`, `y`, `width`, `height`, relative to the frame);
- the lines of all its text, in document order: the text drawn on each line, where it starts and how wide it is (from `Range.getClientRects` over each grapheme cluster), its line box (`top`, `height`) and baseline. White space that collapsed is left out, and so are the spaces that hang at a soft wrap. A line Chrome ends in an ellipsis is marked `truncated`, but its text and width are the whole line's: Chrome doesn't say where it cut it.

For a fixture with `screenshot: true`, it also stores a PNG of the frame (on a transparent page), which the test compares with canvas's pixels.

`chrome-references.test.tsx` then checks, without Chrome:

- that every fixture has a reference, made from its markup as it is;
- that the references hold the `transcribed` numbers to 0.01px, and the `transcribedPixels`;
- that canvas lays each fixture out as Chrome did, within the fixture's tolerance (`DEFAULT_TOLERANCE` in `chrome/fixture.ts`: 1px for boxes and the start and top of a line, as Yoga puts boxes on whole pixels; 0.1px for a line's width; 0.01px for line boxes and baselines; 1% of pixels at pixelmatch's 0.1 threshold for screenshots). Texts are compared without trailing spaces or control characters.

A fixture with a `knownDifference` documents where canvas doesn't match Chrome, and why: its tests are expected to fail, and fail once they pass, so that the note goes when the difference does. A `knownPaintDifference` does the same for a fixture that canvas lays out as Chrome does but paints otherwise: only its pixel comparison is expected to fail.

### Regenerating

```sh
pnpm --filter @effing/canvas comparison:chrome            # every module
pnpm --filter @effing/canvas comparison:chrome br painting # some
```

It drives the Chrome installed on the machine through `playwright-core` (no browser download), from `CHROME_PATH` or the usual install location, and records Chrome's version and the platform in each JSON file. Commit the JSON and PNG files it writes; CI has no Chrome and only reads them.

Generate them on macOS. Chrome rounds `line-height: normal` line boxes differently on Linux, and canvas sizes them as Chrome on macOS does (see footnote ⁴ in the [canvas README](../README.md)); text is also rasterised differently across platforms, so screenshots taken elsewhere won't match canvas as closely. Fonts that aren't in `_helpers/fonts/` (emoji, CJK, a glyph a font doesn't have) come from the system in Chrome and differ from canvas's: keep fixtures to the bundled fonts, or give them a tolerance and say why.

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

   Give every element whose box or lines should be compared an `id`. `paragraph()` puts text in a box of its own width, as `layoutText` lays it out. Set the font: canvas defaults to Helvetica, which Chrome has as a system font.

2. Run `pnpm --filter @effing/canvas comparison:chrome <module>`, look at what Chrome made of it (the JSON, the PNG), and run `pnpm --filter @effing/canvas test:comparison`.
3. Where canvas differs, fix canvas, or set a `tolerance` or a `knownDifference` (`knownPaintDifference` where only its pixels differ) with the reason. A tolerance for pixels is what canvas was measured to differ by, with room to spare, and says why it differs: text, for one, is rasterised heavier by Chrome on macOS, and differs most where it's small and on a frame cut to it.

Write fixtures so that CSS and canvas read them alike:

- Give line heights in px (`"30px"`): a number is a multiple of the font size in CSS, but px above 5 in canvas. The generator refuses one.
- Align text in a box with `flexDirection: "column"` on the box: Chrome stretches the text's anonymous flex item across a column, where in a row it's only as wide as its text, so `textAlign` has nothing to align it in.
- Set `flexShrink` where an item should shrink: canvas defaults it to 0 (as Satori does), except for an element of nothing but text; the generator sets it the same way.
- `text-overflow: ellipsis` needs `overflow: hidden` in Chrome.
