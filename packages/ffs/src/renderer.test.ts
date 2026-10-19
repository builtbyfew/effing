import http from "node:http";
import { afterAll, beforeAll, describe, test, expect } from "vitest";
import { annieBuffer } from "@effing/annie";
import { EffieRenderer } from "./renderer";
import { FetchError } from "./handlers/errors";
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

// Access the private command builder for filter-graph assertions.
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

function filterComplex(layer: {
  delay?: number;
  from?: number;
  until?: number;
}): string {
  return buildFilterComplex(makeEffie(layer));
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
      "[seg0_layer0]fps=30,format=yuva420p,tpad=start_duration=2:color=black@0,fps=30,trim=duration=10[delayed_seg0_layer0]",
    );
  });

  test("without delay, the layer feeds the overlay directly", () => {
    expect(filterComplex({})).not.toContain("tpad");
    expect(filterComplex({})).toContain("[bg_seg0][seg0_layer0]overlay=");
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
    const filterComplex = buildFilterComplex(multiSegmentEffie());

    // Without `apad` before `atrim`, audio shorter than the segment
    // would end early and concat would start the next segment's audio
    // before the current segment's video finished playing.
    expect(filterComplex).toContain("apad,atrim=start=0:duration=5");
    expect(filterComplex).toContain("[aud_seg0]");
    expect(filterComplex).toContain("[aud_seg1]");
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
    return buildFilterComplex(audioEffie(audio));
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

describe("EffieRenderer background cover-scale", () => {
  // Cover-scaling a background whose aspect doesn't divide evenly into the
  // frame (1920x1080 into 1080x1920 scales to 3413.33x1920 -> 3413x1920)
  // makes ffmpeg's `scale` filter compensate with a non-square SAR
  // (10240:10239), which `crop` preserves. Segments that use a different
  // source (a colour, a 9:16 clip) keep SAR 1:1, and `concat` refuses to
  // join streams whose SAR differs, so the render fails with "Nothing was
  // written into output file". Both background chains must reset the SAR
  // to 1:1 right after the crop.
  function backgroundEffie(): EffieData<EffieSources> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "video", source: "https://example.com/bg.mp4" },
      segments: [
        { duration: 1, layers: [] },
        {
          duration: 1,
          background: {
            type: "video",
            source: "https://example.com/seg.mp4",
            seek: 2,
          },
          layers: [],
        },
        { duration: 1, layers: [] },
      ],
    };
  }

  test("global background resets SAR to 1:1 after the cover crop", () => {
    expect(buildFilterComplex(backgroundEffie())).toContain(
      "[0:v]fps=30,scale=100x100:force_original_aspect_ratio=increase,crop=100:100,setsar=1,split=2[bg_split_0][bg_split_1]",
    );
  });

  test("global background is split once per segment that uses it", () => {
    // Segments 0 and 2 use the global background; segment 1 has its own.
    const graph = buildFilterComplex(backgroundEffie());
    expect(graph).toContain("[bg_split_0]trim=start=0:duration=1");
    expect(graph).toContain("[bg_split_1]trim=start=2:duration=1");
  });

  test("a single global background consumer still goes through split", () => {
    const effie = backgroundEffie();
    effie.segments = [effie.segments[0]];
    expect(buildFilterComplex(effie)).toContain(
      "setsar=1,split=1[bg_split_0];[bg_split_0]trim=start=0:duration=1",
    );
  });

  test("segment background resets SAR to 1:1 after the cover crop", () => {
    expect(buildFilterComplex(backgroundEffie())).toContain(
      "[1:v]fps=30,scale=100x100:force_original_aspect_ratio=increase,crop=100:100,setsar=1,trim=start=2:duration=1",
    );
  });
});

describe("EffieRenderer static images", () => {
  // Static images are opened as a single frame and repeated with the loop
  // filter, so FFmpeg decodes (and converts or cover-scales) each image once
  // rather than once per output frame, as it did with `-loop 1` inputs.
  type Command = {
    inputs: { index: number; preArgs: string[]; type: string }[];
    filterComplex: string;
  };

  function buildCommand(effie: EffieData<EffieSources>, scale = 1): Command {
    const renderer = new EffieRenderer(effie);
    return (
      renderer as unknown as {
        buildFFmpegCommand: (out: string, scale: number) => Command;
      }
    ).buildFFmpegCommand("out.mp4", scale);
  }

  function imageEffie(): EffieData<EffieSources> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "image", source: "https://example.com/bg.png" },
      segments: [
        {
          duration: 2,
          layers: [
            {
              type: "image",
              source: "https://example.com/img.png",
              effects: [{ type: "fade-in", start: 0, duration: 1 }],
            },
            {
              type: "animation",
              source: "https://example.com/anim.tar",
            },
          ],
        },
        {
          duration: 1,
          background: { type: "image", source: "https://example.com/seg.jpg" },
          transition: { type: "fade", duration: 0.5 },
          layers: [
            {
              type: "image",
              source: "https://example.com/img.png",
              delay: 0.25,
            },
          ],
        },
      ],
    };
  }

  test("image inputs are opened as a single frame, without -loop or -t", () => {
    const { inputs } = buildCommand(imageEffie());
    const images = inputs.filter((input) => input.type === "image");
    // Global background, segment background, two image layers.
    expect(images).toHaveLength(4);
    for (const input of images) {
      // -framerate gives the frame a 1/fps duration, which the loop filter
      // uses to space the repeated frames.
      expect(input.preArgs).toEqual(["-framerate", "30"]);
    }
  });

  test("animation inputs are unchanged", () => {
    const { inputs, filterComplex } = buildCommand(imageEffie());
    const animation = inputs.find((input) => input.type === "animation")!;
    expect(animation.preArgs).toEqual(["-f", "image2", "-framerate", "30"]);
    expect(filterComplex).toContain(
      `[${animation.index}:v]trim=start=0:duration=2,setsar=1,setpts=PTS-STARTPTS[seg0_layer1]`,
    );
  });

  test("an image layer is converted once, looped, then trimmed to the segment", () => {
    const { filterComplex } = buildCommand(imageEffie());
    expect(filterComplex).toContain(
      "[2:v]format=yuva420p,loop=loop=-1:size=1,trim=start=0:duration=2,fade=t=in:st=0:d=1:alpha=1,setsar=1,setpts=PTS-STARTPTS[seg0_layer0]",
    );
  });

  test("a delayed image layer is looped before the delay-reduced trim", () => {
    const { filterComplex } = buildCommand(imageEffie());
    expect(filterComplex).toContain(
      "[4:v]format=yuva420p,loop=loop=-1:size=1,trim=start=0:duration=0.75,setsar=1,setpts=PTS-STARTPTS[seg1_layer0]",
    );
    expect(filterComplex).toContain(
      "[seg1_layer0]fps=30,format=yuva420p,tpad=start_duration=0.25:color=black@0,fps=30,trim=duration=1[delayed_seg1_layer0]",
    );
  });

  test("an image background is cover-scaled once, then looped", () => {
    const { filterComplex } = buildCommand(imageEffie());
    expect(filterComplex).toContain(
      "[0:v]scale=100x100:force_original_aspect_ratio=increase,crop=100:100,setsar=1,loop=loop=-1:size=1,fps=30,split=1[bg_split_0]",
    );
    expect(filterComplex).toContain(
      "[1:v]scale=100x100:force_original_aspect_ratio=increase,crop=100:100,setsar=1,loop=loop=-1:size=1,fps=30,trim=start=0:duration=1,setpts=PTS-STARTPTS[bg_seg1]",
    );
  });

  test("a scaled render covers the background to the scaled frame before looping", () => {
    const { filterComplex } = buildCommand(imageEffie(), 0.5);
    expect(filterComplex).toContain(
      "[0:v]scale=50x50:force_original_aspect_ratio=increase,crop=50:50,setsar=1,loop=loop=-1:size=1,fps=30,split=1[bg_split_0]",
    );
  });
});

describe("EffieRenderer source failures", () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    // An annie whose fn fails after its first frame: the frame goes out, then
    // the connection is cut.
    const annie = await annieBuffer(
      (async function* () {
        yield Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      })(),
    );
    server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/x-tar" });
      // The TAR header and the frame, without the end-of-archive blocks.
      res.write(annie.subarray(0, 1024), () => res.destroy());
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}/annie`;
  });

  afterAll(() => {
    server.close();
  });

  test("a source that fails mid-body fails the render, naming it", async () => {
    const renderer = new EffieRenderer({
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      segments: [{ duration: 1, layers: [{ type: "animation", source: url }] }],
    });
    const error = await renderer.render().then(
      () => undefined,
      (err: unknown) => err,
    );
    renderer.close();
    // A FetchError, so it's reported as FETCH_FAILED.
    expect(error).toBeInstanceOf(FetchError);
    expect(error).toMatchObject({
      url,
      message: `Failed to fetch ${url}: response body failed: terminated`,
      cause: expect.objectContaining({ message: "terminated" }),
    });
  });
});
