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
    // Without this, the transparent padding prefix would be composited over
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
    // The padded layer must be exactly `segment.duration` long, not
    // `segment.duration + delay` — otherwise overlay's default eof_action
    // extends the rendered output past the segment.
    expect(filterComplex({ delay: 2 })).toContain("trim=start=0:duration=8");
    expect(filterComplex({ delay: 2 })).toContain(
      "color=c=black@0:size=100x100:duration=2:rate=30,format=yuva420p",
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

describe("EffieRenderer general audio fades", () => {
  function audioEffie(audio: {
    seek?: number;
    fadeIn?: number;
    fadeOut?: number;
  }): EffieData<EffieSources> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      audio: { source: "https://example.com/music.mp3", ...audio },
      segments: [
        {
          duration: 10,
          layers: [{ type: "image", source: "https://example.com/img.png" }],
        },
      ],
    };
  }

  function generalAudioFilter(audio: {
    seek?: number;
    fadeIn?: number;
    fadeOut?: number;
  }): string {
    const renderer = new EffieRenderer(audioEffie(audio));
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

  test("fades are applied after PTS is reset, so a seek doesn't shift the fade anchors", () => {
    // `atrim` preserves source timestamps, so after a 4.9s seek the stream's
    // PTS starts at 4.9. afade anchors on PTS, so resetting PTS to 0 must
    // happen *before* the fades — otherwise the 1s fade-out would start at
    // ~4.1s of playback (10 - 1 - 4.9) and the back half would be silent.
    expect(generalAudioFilter({ seek: 4.9, fadeIn: 1, fadeOut: 1 })).toContain(
      "atrim=start=4.9:duration=10,asetpts=PTS-STARTPTS," +
        "afade=type=in:start_time=0:duration=1," +
        "afade=type=out:start_time=9:duration=1[general_audio]",
    );
  });

  test("fade-out still anchors at the end with no seek", () => {
    expect(generalAudioFilter({ fadeOut: 2 })).toContain(
      "atrim=start=0:duration=10,asetpts=PTS-STARTPTS," +
        "afade=type=out:start_time=8:duration=2[general_audio]",
    );
  });
});
