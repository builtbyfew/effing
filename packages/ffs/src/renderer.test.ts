import { describe, test, expect } from "vitest";
import { EffieRenderer } from "./renderer";
import type { EffieData, EffieSources } from "@effing/effie";

function makeEffie(layer: {
  delay?: number;
  from?: number;
  until?: number;
}): EffieData<EffieSources> {
  return {
    width: 100,
    height: 100,
    fps: 30,
    cover: "https://example.com/cover.png",
    background: { type: "color", color: "black" },
    segments: [
      {
        duration: 10,
        layers: [
          {
            type: "image",
            source: "https://example.com/img.png",
            ...layer,
          },
        ],
      },
    ],
  };
}

function filterComplex(layer: {
  delay?: number;
  from?: number;
  until?: number;
}): string {
  const renderer = new EffieRenderer(makeEffie(layer));
  // Access private method for filter-graph assertions.
  const command = (
    renderer as unknown as {
      buildFFmpegCommand: (
        out: string,
        scale: number,
      ) => { filterComplex: string };
    }
  ).buildFFmpegCommand("out.mp4", 1);
  return command.filterComplex;
}

describe("EffieRenderer overlay enable window", () => {
  test("with no delay, enable defaults to [0, segment.duration]", () => {
    expect(filterComplex({})).toContain("enable='between(t,0,10)'");
  });

  test("with delay and no `from`, enable starts at delay", () => {
    // Without this, the nullsrc-padded prefix would be composited over
    // the canvas during [0, delay] — see commit message for detail.
    expect(filterComplex({ delay: 2 })).toContain("enable='between(t,2,10)'");
  });

  test("explicit `from` overrides delay-driven default", () => {
    expect(filterComplex({ delay: 2, from: 1 })).toContain(
      "enable='between(t,1,10)'",
    );
  });

  test("explicit `until` is respected alongside delay", () => {
    expect(filterComplex({ delay: 2, until: 5 })).toContain(
      "enable='between(t,2,5)'",
    );
  });
});
