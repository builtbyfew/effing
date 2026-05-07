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

  test("layer trim is reduced by `delay` so the padded stream matches segment duration", () => {
    // The nullsrc-padded layer must be exactly `segment.duration` long, not
    // `segment.duration + delay` — otherwise overlay's default eof_action
    // extends the rendered output past the segment.
    expect(filterComplex({ delay: 2 })).toContain("trim=start=0:duration=8");
    expect(filterComplex({ delay: 2 })).toContain(
      "nullsrc=size=100x100:duration=2",
    );
  });
});

describe("EffieRenderer segment audio padding", () => {
  function multiSegmentEffie(): EffieData<EffieSources> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      segments: [
        {
          duration: 5,
          audio: { source: "https://example.com/voice1.mp3" },
          layers: [{ type: "image", source: "https://example.com/img1.png" }],
        },
        {
          duration: 5,
          audio: { source: "https://example.com/voice2.mp3" },
          layers: [{ type: "image", source: "https://example.com/img2.png" }],
        },
      ],
    };
  }

  test("segment audio is padded with silence so short audio doesn't cause the next segment's audio to start early", () => {
    const renderer = new EffieRenderer(multiSegmentEffie());
    const command = (
      renderer as unknown as {
        buildFFmpegCommand: (
          out: string,
          scale: number,
        ) => { filterComplex: string };
      }
    ).buildFFmpegCommand("out.mp4", 1);

    // Without `apad` before `atrim`, audio shorter than the segment
    // would end early and concat would start the next segment's audio
    // before the current segment's video finished playing.
    expect(command.filterComplex).toContain("apad,atrim=start=0:duration=5");
    expect(command.filterComplex).toContain("[aud_seg0]");
    expect(command.filterComplex).toContain("[aud_seg1]");
  });
});
