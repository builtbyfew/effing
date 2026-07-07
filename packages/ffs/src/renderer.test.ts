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

describe("EffieRenderer background color guard", () => {
  function colorEffie(color: string): EffieData<EffieSources> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color },
      segments: [
        {
          duration: 10,
          layers: [{ type: "image", source: "https://example.com/img.png" }],
        },
      ],
    };
  }

  function buildCommand(color: string): {
    inputs: { preArgs: string[]; type: string }[];
  } {
    const renderer = new EffieRenderer(colorEffie(color));
    return (
      renderer as unknown as {
        buildFFmpegCommand: (
          out: string,
          scale: number,
        ) => { inputs: { preArgs: string[]; type: string }[] };
      }
    ).buildFFmpegCommand("out.mp4", 1);
  }

  test("a valid hex color is passed through to the lavfi color source", () => {
    const command = buildCommand("#ff0000");
    const colorInput = command.inputs.find((input) => input.type === "color");
    expect(colorInput?.preArgs).toContain("color=#ff0000:size=100x100:rate=30");
  });

  test("a color containing filtergraph metacharacters is rejected", () => {
    // The color is interpolated into a lavfi filtergraph description; without
    // this guard it could smuggle in extra filters (e.g. a file-reading
    // `movie=` source). The schema already rejects such values, but the
    // renderer must too, because validation can be skipped
    // (FFS_SKIP_VALIDATION).
    expect(() =>
      buildCommand("red:duration=1[out0];movie=/etc/passwd[out1]"),
    ).toThrow(/Invalid background color/);
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

describe("EffieRenderer audio mixing levels", () => {
  function buildFilterComplex(effie: EffieData<EffieSources>): string {
    const renderer = new EffieRenderer(effie);
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

  function base(): Omit<EffieData<EffieSources>, "segments" | "audio"> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
    };
  }

  function globalAndSegmentAudioEffie(): EffieData<EffieSources> {
    return {
      ...base(),
      audio: { source: "https://example.com/music.mp3" },
      segments: [
        {
          duration: 5,
          audio: { source: "https://example.com/voice.mp3" },
          layers: [{ type: "image", source: "https://example.com/img.png" }],
        },
      ],
    };
  }

  function globalAudioOnlyEffie(): EffieData<EffieSources> {
    return {
      ...base(),
      audio: { source: "https://example.com/music.mp3" },
      segments: [
        {
          duration: 5,
          layers: [{ type: "image", source: "https://example.com/img.png" }],
        },
      ],
    };
  }

  function segmentAudioOnlyEffie(): EffieData<EffieSources> {
    return {
      ...base(),
      segments: [
        {
          duration: 5,
          audio: { source: "https://example.com/voice.mp3" },
          layers: [{ type: "image", source: "https://example.com/img.png" }],
        },
      ],
    };
  }

  test("amix uses normalize=0 so sources keep their configured volume instead of being halved", () => {
    // amix defaults to normalize=1, which scales each input by 1/n (−6 dB for
    // two inputs). The segment path always feeds amix a full-length stream
    // (real audio or synthesized anullsrc silence), so both inputs stay
    // "active" the whole time and the global track is consistently halved.
    // normalize=0 keeps every source at its configured volume.
    const filterComplex = buildFilterComplex(globalAndSegmentAudioEffie());
    expect(filterComplex).toContain(
      "[general_audio][segments_audio]amix=inputs=2:duration=longest:normalize=0,",
    );
    // Guard against regressing to amix's default normalization.
    expect(filterComplex).not.toContain("amix=inputs=2:duration=longest[outa]");
  });

  test("global audio over silent segments is no longer halved", () => {
    // The most common case: a background track over segments with no audio.
    // The silent segments still produce a continuous anullsrc stream, so under
    // normalize=1 the global track was halved despite being the only real
    // source.
    const filterComplex = buildFilterComplex(globalAudioOnlyEffie());
    expect(filterComplex).toContain(
      "amix=inputs=2:duration=longest:normalize=0,",
    );
  });

  test("the mixed master is peak-limited to prevent clipping introduced by normalize=0", () => {
    const filterComplex = buildFilterComplex(globalAndSegmentAudioEffie());
    expect(filterComplex).toContain("alimiter=limit=1:level=false[outa]");
  });

  test("the no-global-audio path is also peak-limited on the master bus", () => {
    const filterComplex = buildFilterComplex(segmentAudioOnlyEffie());
    expect(filterComplex).toContain(
      ":v=0:a=1,alimiter=limit=1:level=false[outa]",
    );
  });
});
