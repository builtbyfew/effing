import type React from "react";
import { SANS, fixtureModule } from "../fixture.ts";
import type { ChromeFixture } from "../fixture.ts";

// Box and text shadows, compared pixel by pixel with Chrome's screenshot:
// the CSS syntax (lists, spread, inset, the colour first or left out), on
// white.

const frame = (
  name: string,
  width: number,
  height: number,
  children: React.ReactNode,
  rest: Partial<ChromeFixture> = {},
): ChromeFixture => ({
  name,
  width,
  height,
  screenshot: true,
  element: (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        width,
        height,
        padding: 20,
        gap: 30,
        backgroundColor: "white",
        fontFamily: SANS,
        fontSize: 32,
      }}
    >
      {children}
    </div>
  ),
  ...rest,
});

/** A box with a shadow, and whatever else `style` gives it. */
const box = (
  id: string,
  boxShadow: string,
  style: React.CSSProperties = {},
): React.ReactNode => (
  <div
    key={id}
    id={id}
    style={{
      width: 80,
      height: 50,
      backgroundColor: "#e2e8f0",
      boxShadow,
      ...style,
    }}
  />
);

/**
 * Box shadows: at most 0.15% of pixels differ at a threshold of 0.03 (edges
 * antialiased otherwise). A shadow 1px further off differs by 1% to 5.6%, one
 * 1px wider by 5.5% to 16%, and one blurred 1px more by up to 2.1%.
 */
const BOX_SHADOWS = { pixelThreshold: 0.03, pixels: 0.3 };

/** A frame of boxes, one for each shadow. */
const boxes = (
  name: string,
  shadows: (string | [string, React.CSSProperties])[],
  rest: Partial<ChromeFixture> = {},
): ChromeFixture =>
  frame(
    name,
    40 + shadows.length * 80 + (shadows.length - 1) * 30,
    90,
    shadows.map((s, i) =>
      typeof s === "string" ? box(`b${i}`, s) : box(`b${i}`, s[0], s[1]),
    ),
    { tolerance: BOX_SHADOWS, ...rest },
  );

/** Text with a shadow. */
const text = (
  name: string,
  textShadow: string,
  style: React.CSSProperties = {},
  rest: Partial<ChromeFixture> = {},
): ChromeFixture =>
  frame(
    name,
    200,
    80,
    <div id="t" style={{ color: "#1e3a8a", textShadow, ...style }}>
      Shadowed
    </div>,
    rest,
  );

const fixtures: ChromeFixture[] = [
  // Box shadows.
  boxes("casts a blurred box shadow", [
    "4px 6px 8px #1e293b",
    ["4px 6px 8px #1e293b", { borderRadius: 16 }],
  ]),
  boxes("grows a box shadow by its spread", [
    "0 0 0 6px #ef4444",
    ["0 0 0 6px #ef4444", { borderRadius: 16 }],
    // A radius smaller than the spread grows by less than it.
    ["0 0 0 12px #ef4444", { borderRadius: 4 }],
    ["4px 4px 6px 4px #1e293b", { borderRadius: 12 }],
  ]),
  boxes("shrinks a box shadow by a negative spread", [
    "0 12px 8px -6px #1e293b",
    ["0 14px 6px -8px #1e293b", { borderRadius: 20 }],
    // Shrunk to nothing.
    "0 0 4px -40px #1e293b",
  ]),
  boxes("casts an inset box shadow", [
    "inset 4px 6px 8px #1e293b",
    ["inset 4px 6px 8px #1e293b", { borderRadius: 16 }],
    ["inset 0 0 0 8px #3b82f6", { borderRadius: 20 }],
    // Inside the border: in the padding box, with its smaller radii.
    [
      "-4px -4px 6px #ef4444 inset",
      { borderRadius: 16, border: "4px solid #22c55e" },
    ],
  ]),
  boxes("casts several box shadows, the first on top", [
    "4px 4px 0 #ef4444, 8px 8px 0 #3b82f6",
    [
      "0 8px 16px 6px #0002, 0 2px 6px 0 #0003",
      { backgroundColor: "white", borderRadius: 8 },
    ],
    [
      "inset 0 0 0 4px #ef4444, 0 0 0 4px #3b82f6, inset 6px 6px 8px #1e293b",
      { borderRadius: 12 },
    ],
  ]),
  boxes("reads a box shadow's colour first, or as currentColor", [
    "#ef4444 4px 4px 6px",
    "rgb(59 130 246 / 0.6) 6px 6px",
    ["5px 5px 4px", { color: "#22c55e" }],
    "inset #ef4444 4px 4px 6px",
  ]),
  boxes("ignores an invalid box shadow", [
    "4px #ef4444 4px",
    "4px 4px -2px #ef4444",
    "4px 4px 0 #ef4444,",
  ]),

  // Text shadows. Chrome on macOS rasterises glyphs heavier, so where the
  // text alone differs by 0.18% of pixels in this frame, a shadow doubles the
  // glyph edges that differ: each tolerance is what was measured with room to
  // spare, below what a shadow 1px further off or blurred 1px more differs by
  // (noted for each).
  text(
    "casts a text shadow without a blur",
    "3px 3px #ef4444",
    {},
    {
      // 1.08%; 1px off: 1.7%, blurred: 2.3%.
      tolerance: { pixels: 1.5 },
    },
  ),
  text(
    "reads a text shadow's colour first",
    "#ef4444 2px 3px 3px",
    {},
    {
      // 1.81%; 1px off: 2.5%, blurred more: 4.5%.
      tolerance: { pixels: 2.2 },
    },
  ),
  text(
    "casts a text shadow in currentColor",
    "3px 3px 2px",
    { color: "#22c55e" },
    // 1.68%; 1px off: 3.6%, blurred more: 5.2%.
    { tolerance: { pixels: 2.3 } },
  ),
  text(
    "casts several text shadows, the first on top",
    "2px 2px 0 #ef4444, 4px 4px 0 #3b82f6, 0 0 6px #facc15",
    {},
    // 1.98%; 1px off: 3.6%, blurred more: 2.8%.
    { tolerance: { pixels: 2.5 } },
  ),
];

export default fixtureModule("shadows", fixtures);
