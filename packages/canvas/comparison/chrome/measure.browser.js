// Runs in headless Chrome, on the page `generate.tsx` builds: it prepares a
// fixture's markup to lay out as canvas does, and measures it. Plain
// JavaScript, as the page loads it as it is.

(() => {
  const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
  const round = (value) => Math.round(value * 1e4) / 1e4;
  /** Spaces that hang at a soft wrap (CSS Text 3 §4.1.3). */
  const HANGING = /^[ \t]+$/;
  /** White space that collapses where `white-space` collapses it. */
  const COLLAPSIBLE = /^[ \t\n\r]+$/;

  const isBr = (node) =>
    node.nodeType === Node.ELEMENT_NODE && node.localName === "br";
  const isText = (node) => node.nodeType === Node.TEXT_NODE;

  /**
   * The children of `element` as canvas has them (`flattenChildren` in
   * `src/jsx/layout.ts`): elements, and runs of adjacent text and <br>s.
   * Comments (React's markers between adjacent text) are no items.
   */
  function itemsOf(element) {
    const items = [];
    let run = null;
    for (const node of element.childNodes) {
      if (isText(node) || isBr(node)) {
        if (!run) items.push((run = { run: [] }));
        run.run.push(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        run = null;
        items.push({ element: node });
      }
    }
    // A run of nothing but white space is no item (`isBlankRun`).
    return items.filter(
      (item) =>
        !item.run ||
        item.run.some(isBr) ||
        !/^[ \t\n\r\f\v]*$/.test(item.run.map((n) => n.data).join("")),
    );
  }

  /** The value of `property` in the style of `element` or an ancestor. */
  function inherited(element, property) {
    for (let e = element; e && e.id !== "__frame"; e = e.parentElement) {
      const value = e.style.getPropertyValue(property);
      if (value) return value;
    }
    return "";
  }

  /**
   * Lay the markup out as canvas lays the element out, where CSS has other
   * defaults than canvas and no rule in `generate.tsx` can say so:
   *
   * - `flex-shrink` is 0 unless set, but 1 for an element whose only content
   *   is a run of text (`applyStylesToYoga`, `buildNode`);
   * - `lineClamp` is Chrome's `-webkit-line-clamp`, which takes a
   *   `-webkit-box`;
   * - `textBoxTrim`, `textBoxEdge` and `textOverflow` are inherited, and
   *   apply to the text of an element of nothing but text, which takes a
   *   block container in CSS;
   * - a number for `lineHeight` above 5 is pixels in canvas, but a multiple
   *   of the font size in CSS: fixtures must give it in px.
   */
  function prepare(frame) {
    for (const element of frame.querySelectorAll("*")) {
      if (element.closest("svg") || isBr(element)) continue;
      const style = element.getAttribute("style") ?? "";
      const clamp = /(?:^|;)\s*line-clamp\s*:\s*(\d+)/.exec(style);
      if (clamp) {
        // A -webkit-box stacks its children, where canvas lays them out in
        // the element's row: only text (and <br>s) clamp alike.
        if ([...element.children].some((child) => !isBr(child))) {
          throw new Error(
            `lineClamp on <${element.localName}> with elements in it: Chrome's -webkit-box stacks them, unlike canvas`,
          );
        }
        element.style.display = "-webkit-box";
        element.style.webkitBoxOrient = "vertical";
        element.style.webkitLineClamp = clamp[1];
        element.dataset.lineClamp = clamp[1];
      }
      const lineHeight = element.style.lineHeight;
      if (/^[\d.]+$/.test(lineHeight) && parseFloat(lineHeight) > 5) {
        throw new Error(
          `line-height: ${lineHeight} on <${element.localName}> is ${lineHeight}em in CSS but ${lineHeight}px in canvas: give it as "${lineHeight}px"`,
        );
      }
      const items = itemsOf(element);
      const onlyText = items.length === 1 && items[0].run !== undefined;
      if (element.style.flexShrink === "") {
        element.style.flexShrink = onlyText ? "1" : "0";
      }
      // `textBoxTrim`, `textBoxEdge` and `textOverflow` are inherited in
      // canvas, and apply to the element's text; in CSS they apply to a
      // block container's, which the text's anonymous flex item doesn't
      // inherit them into. An element of nothing but text with any of them
      // is a block container here (a clamped one is a -webkit-box already).
      if (!onlyText) continue;
      const inheritedText = [
        ["text-box-trim", "none"],
        ["text-box-edge", "auto"],
        ["text-overflow", "clip"],
      ]
        .map(([property, initial]) => [
          property,
          inherited(element, property) || initial,
          initial,
        ])
        .filter(([, value, initial]) => value !== initial);
      // The edge alone does nothing.
      if (inheritedText.every(([property]) => property === "text-box-edge")) {
        continue;
      }
      // A block container has no `justify-content`, which canvas honours:
      // it places the text in the element by it (and grows it across the
      // element only at flex-start), so the two would part.
      const justify = element.style.justifyContent;
      if (!clamp && !["", "normal", "flex-start"].includes(justify)) {
        throw new Error(
          `justify-content: ${justify} on <${element.localName}> with ${inheritedText.map(([p]) => p).join(", ")}: Chrome applies those to a block container, which has no justify-content`,
        );
      }
      if (!clamp) element.style.display = "flow-root";
      for (const [property, value] of inheritedText) {
        element.style.setProperty(property, value);
      }
    }
  }

  const metricsCache = new Map();

  /**
   * The line box of a line of text in `element`'s font and line height,
   * where the line's text starts and where its baseline is, all relative to
   * the line box's top: measured on a line of its own, outside the fixture.
   */
  function lineMetrics(element) {
    const style = getComputedStyle(element);
    const font = [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "font-stretch",
      "line-height",
    ].map((property) => [property, style.getPropertyValue(property)]);
    const key = JSON.stringify(font);
    let metrics = metricsCache.get(key);
    if (!metrics) {
      /** A line of "x", and a mark at its baseline if `marked`. */
      const probe = (marked) => {
        const line = document.createElement("div");
        line.style.cssText =
          "position: absolute; left: 0; top: 0; display: block; width: max-content; white-space: pre; visibility: hidden;";
        for (const [property, value] of font) {
          line.style.setProperty(property, value);
        }
        const text = document.createTextNode("x");
        line.append(text);
        // An empty inline-block sits with its bottom on the baseline.
        const mark = document.createElement("span");
        mark.style.cssText = "display: inline-block; width: 0; height: 0;";
        if (marked) line.append(mark);
        document.body.append(line);
        const range = document.createRange();
        range.selectNodeContents(text);
        const box = line.getBoundingClientRect();
        const content = range.getBoundingClientRect().top;
        const baseline = mark.getBoundingClientRect().bottom;
        line.remove();
        return { box, content, baseline };
      };
      // The mark can make the line box taller (for a small line height):
      // the line box is measured without it, and the baseline from the top
      // of the text's content area.
      const plain = probe(false);
      const marked = probe(true);
      const content = plain.content - plain.box.top;
      metrics = {
        height: plain.box.height,
        content,
        baseline: content + marked.baseline - marked.content,
      };
      metricsCache.set(key, metrics);
    }
    return metrics;
  }

  /** The element whose `-webkit-line-clamp` clamps `element`'s lines. */
  const clampOf = (element) => element.closest("[data-line-clamp]");

  /**
   * The lines of a run of text and <br>s in `parent`: each one's rendered
   * text, where it starts and how wide it is, and its line box.
   */
  function linesOfRun(parent, nodes, origin) {
    const style = getComputedStyle(parent);
    const collapse = style.whiteSpaceCollapse;
    const preservesSpaces =
      collapse === "preserve" || collapse === "break-spaces";
    const forcesNewlines = collapse !== "collapse";
    const metrics = lineMetrics(parent);
    // The text as drawn, which the DOM has before its `text-transform`.
    const transform = (text, before) => {
      switch (style.textTransform) {
        case "uppercase":
          return text.toUpperCase();
        case "lowercase":
          return text.toLowerCase();
        case "capitalize":
          return before === undefined || /\s/.test(before)
            ? text.charAt(0).toUpperCase() + text.slice(1)
            : text;
        default:
          return text;
      }
    };
    const collapsed = metrics.height < 1;

    // Every grapheme cluster and <br>, with its boxes on the page. A space
    // that collapses has a box of no width, or none.
    const pieces = [];
    for (const node of nodes) {
      if (isBr(node)) {
        const rects = [...node.getClientRects()];
        if (rects.length > 0) pieces.push({ br: true, text: "", rects });
        continue;
      }
      for (const { segment, index } of graphemes.segment(node.data)) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + segment.length);
        pieces.push({
          text: transform(segment, node.data[index - 1]),
          rects: [...range.getClientRects()],
        });
      }
    }

    // Lines, from where each piece's first box is: a soft wrap's space is on
    // the line it ends, and a newline's too. Where line boxes have no height
    // (`line-height: 0`), they're all at one height, so a line also starts
    // where the text goes back to the left.
    const lines = [];
    let line = null;
    for (const piece of pieces) {
      const first = piece.rects[0];
      if (!first) {
        line?.pieces.push(piece);
        continue;
      }
      const startsLine =
        !line ||
        Math.abs(first.top - line.top) > 0.5 ||
        (collapsed && first.width > 0 && first.left < line.right - 0.5);
      if (startsLine) {
        line = { top: first.top, right: -Infinity, pieces: [] };
        lines.push(line);
      }
      line.pieces.push(piece);
      if (first.width > 0) line.right = Math.max(line.right, first.right);
    }

    const result = [];
    lines.forEach((line, index) => {
      const onLine = (piece) =>
        piece.rects.filter((r) => Math.abs(r.top - line.top) <= 0.5);
      const drawn = (piece) => onLine(piece).some((r) => r.width > 0);
      const isForced = (piece) =>
        piece.br || (forcesNewlines && /^(\r\n|\n)$/.test(piece.text));
      // The line ends at a soft wrap if it isn't the run's last and no
      // forced break ends it.
      const softWrap = index < lines.length - 1 && !line.pieces.some(isForced);
      const forced = line.pieces.some(isForced);

      // What's drawn, or would be at a font size of 0: all but white space
      // of no width.
      const shown = (piece) => drawn(piece) || !COLLAPSIBLE.test(piece.text);
      let kept = line.pieces.filter((piece) => !piece.br && !isForced(piece));
      const firstDrawn = kept.findIndex(shown);
      const lastDrawn = kept.findLastIndex(shown);
      if (firstDrawn === -1) {
        // A line of no text: an empty line between forced breaks.
        if (!forced) return;
        kept = [];
      } else {
        kept = kept.slice(firstDrawn, lastDrawn + 1);
        // Text of no width (a font size of 0) keeps one space of each run
        // that collapses, as it would have, had it any width.
        const sized = kept.some(drawn);
        kept = kept.filter(
          // What has no width inside the line is drawn as nothing, as a CR
          // under `pre` is, unless it's white space that collapsed.
          (piece, i) =>
            shown(piece) ||
            (preservesSpaces && !/^\n$/.test(piece.text)) ||
            (!sized && !COLLAPSIBLE.test(kept[i - 1].text)),
        );
        // The spaces that hang at a soft wrap aren't in the line.
        if (softWrap) {
          while (kept.length > 0 && HANGING.test(kept.at(-1).text)) {
            kept.pop();
          }
        }
      }

      const boxes = kept.flatMap(onLine).filter((r) => r.width > 0);
      const anchor =
        boxes[0] ?? onLine(line.pieces.find((p) => onLine(p).length > 0))[0];
      const left = boxes.length
        ? Math.min(...boxes.map((r) => r.left))
        : anchor.left;
      const right = boxes.length
        ? Math.max(...boxes.map((r) => r.right))
        : anchor.left;
      const top = anchor.top - metrics.content - origin.top;
      const text = kept
        .map((piece) =>
          // A newline or tab that collapsed to a space is one.
          !preservesSpaces && COLLAPSIBLE.test(piece.text) ? " " : piece.text,
        )
        .join("");
      result.push({
        text,
        x: round(left - origin.left),
        width: round(right - left),
        top: round(top),
        height: round(metrics.height),
        baseline: round(top + metrics.baseline),
      });
    });

    // Lines a line clamp hides aren't drawn; the last one shown ends in an
    // ellipsis where there's more.
    const clamp = clampOf(parent);
    if (clamp) {
      const box = clamp.getBoundingClientRect();
      const bottom =
        box.bottom -
        origin.top -
        parseFloat(getComputedStyle(clamp).paddingBottom) -
        parseFloat(getComputedStyle(clamp).borderBottomWidth);
      const shown = result.filter((line) => line.top < bottom - 0.5);
      if (shown.length < result.length && shown.length > 0) {
        shown.at(-1).truncated = true;
      }
      return shown;
    }
    // A line that overflows a box that ends it in an ellipsis is cut short.
    if (style.textOverflow === "ellipsis" && style.overflowX !== "visible") {
      const box = parent.getBoundingClientRect();
      const end =
        box.right -
        origin.left -
        parseFloat(style.paddingRight) -
        parseFloat(style.borderRightWidth);
      for (const line of result) {
        if (line.x + line.width > end + 0.5) line.truncated = true;
      }
    }
    return result;
  }

  /** The lines of all text in `element`, in document order. */
  function linesIn(element, origin) {
    if (element.closest("svg")) return [];
    const lines = [];
    for (const item of itemsOf(element)) {
      if (item.run) lines.push(...linesOfRun(element, item.run, origin));
      else lines.push(...linesIn(item.element, origin));
    }
    return lines;
  }

  /**
   * Every element in `frame` with an `id`: its border box and its lines,
   * relative to the frame.
   */
  function measure(frame) {
    const origin = frame.getBoundingClientRect();
    const elements = {};
    for (const element of frame.querySelectorAll("[id]")) {
      const box = element.getBoundingClientRect();
      elements[element.id] = {
        x: round(box.left - origin.left),
        y: round(box.top - origin.top),
        width: round(box.width),
        height: round(box.height),
        lines: linesIn(element, origin),
      };
    }
    return elements;
  }

  window.__chromeReference = { prepare, measure };
})();
