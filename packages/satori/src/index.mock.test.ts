import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockSatori, mockAsPng, mockRender, MockResvg } = vi.hoisted(() => {
  const mockAsPng = vi.fn();
  const mockRender = vi.fn(() => ({ asPng: mockAsPng }));
  const MockResvg = vi.fn(() => ({ render: mockRender }));
  const mockSatori = vi.fn();
  return { mockSatori, mockAsPng, mockRender, MockResvg };
});

vi.mock("satori", () => ({ default: mockSatori }));
vi.mock("@resvg/resvg-js", () => ({ Resvg: MockResvg }));

import React from "react";
import { svgFromSatori, rasterizeSvg, pngFromSatori } from "./index.ts";
import type { SatoriOptions } from "./index.ts";

const opts: SatoriOptions = {
  width: 800,
  height: 600,
  fonts: [
    {
      name: "Test",
      data: Buffer.from("font-data"),
      weight: 400,
      style: "normal",
    },
  ],
};

describe("svgFromSatori", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls satori with width, height, fonts, and loadAdditionalAsset", async () => {
    mockSatori.mockResolvedValue("<svg>ok</svg>");

    const template = React.createElement("div", null, "hi");
    const result = await svgFromSatori(template, opts);

    expect(result).toBe("<svg>ok</svg>");
    expect(mockSatori).toHaveBeenCalledTimes(1);

    const [passedTemplate, passedOpts] = mockSatori.mock.calls[0];
    expect(passedTemplate).toBe(template);
    expect(passedOpts.width).toBe(800);
    expect(passedOpts.height).toBe(600);
    expect(passedOpts.fonts).toBe(opts.fonts);
    expect(typeof passedOpts.loadAdditionalAsset).toBe("function");
  });
});

describe("rasterizeSvg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("constructs Resvg with loadSystemFonts: false and calls render().asPng()", () => {
    const pngBuf = Buffer.from("png-data");
    mockAsPng.mockReturnValue(pngBuf);

    const result = rasterizeSvg("<svg>test</svg>");

    expect(MockResvg).toHaveBeenCalledWith("<svg>test</svg>", {
      font: { loadSystemFonts: false },
    });
    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockAsPng).toHaveBeenCalledTimes(1);
    expect(result).toBe(pngBuf);
  });
});

describe("pngFromSatori", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("composes svgFromSatori + rasterizeSvg", async () => {
    const svgString = "<svg>composed</svg>";
    const pngBuf = Buffer.from("final-png");

    mockSatori.mockResolvedValue(svgString);
    mockAsPng.mockReturnValue(pngBuf);

    const template = React.createElement("div", null, "test");
    const result = await pngFromSatori(template, opts);

    // satori is called first
    expect(mockSatori).toHaveBeenCalledTimes(1);
    // Then Resvg is called with the SVG output
    expect(MockResvg).toHaveBeenCalledWith(svgString, {
      font: { loadSystemFonts: false },
    });
    expect(result).toBe(pngBuf);
  });
});
