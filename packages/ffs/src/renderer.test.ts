import http from "node:http";
import { PassThrough } from "node:stream";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  test,
  expect,
  vi,
} from "vitest";
import { annieBuffer } from "@effing/annie";
import { EffieRenderer } from "./renderer";
import type { EffieRendererOptions } from "./renderer";
import { FFmpegRunner } from "./ffmpeg";
import type { FFmpegInputInfo } from "./ffmpeg";
import { HttpProxy } from "./proxy";
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

  test("animation inputs keep the filter graph when frame properties change", () => {
    // A rebuilt graph would restart every chain's timing and starve the
    // single-frame image inputs, so frames that change format or size are
    // normalised at the head of the layer chain instead.
    const { inputs, filterComplex } = buildCommand(imageEffie());
    const animation = inputs.find((input) => input.type === "animation")!;
    expect(animation.preArgs).toEqual([
      "-reinit_filter",
      "0",
      "-f",
      "image2",
      "-framerate",
      "30",
    ]);
    expect(filterComplex).toContain(
      `[${animation.index}:v]scale=w=iw:h=ih:eval=init,format=yuva420p,trim=start=0:duration=2,setsar=1,setpts=PTS-STARTPTS[seg0_layer1]`,
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

describe("EffieRenderer layer scaling", () => {
  // A scaled render shrinks image and animation layers inside the filter
  // graph, by the render's scale factor, with premultiplied alpha.
  type Command = {
    inputs: { index: number; preArgs: string[]; type: string }[];
    filterComplex: string;
  };

  function buildCommand(effie: EffieData<EffieSources>, scale: number) {
    const renderer = new EffieRenderer(effie);
    return (
      renderer as unknown as {
        buildFFmpegCommand: (out: string, scale: number) => Command;
      }
    ).buildFFmpegCommand("out.mp4", scale);
  }

  function layersEffie(): EffieData<EffieSources> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      segments: [
        {
          duration: 2,
          layers: [
            {
              type: "image",
              source: "https://example.com/img.png",
              effects: [{ type: "fade-in", start: 0, duration: 1 }],
            },
            { type: "image", source: "https://example.com/photo.jpg" },
            {
              type: "animation",
              source: "https://example.com/anim.tar",
              delay: 0.5,
            },
          ],
        },
      ],
    };
  }

  const scale = (f: string) =>
    `scale=w='max(1,trunc(iw*${f}))':h='max(1,trunc(ih*${f}))'`;
  const scaleFilters = (f: string) =>
    `format=alpha_modes=premultiplied,${scale(f)},format=alpha_modes=straight`;

  test("an image layer is scaled once, before it is converted and looped", () => {
    const { filterComplex } = buildCommand(layersEffie(), 0.5);
    expect(filterComplex).toContain(
      `[1:v]${scaleFilters("0.5")},format=yuva420p,loop=loop=-1:size=1,trim=start=0:duration=2,fade=t=in:st=0:d=1:alpha=1,setsar=1,setpts=PTS-STARTPTS[seg0_layer0]`,
    );
  });

  test("an animation layer is normalised, premultiplied and scaled after the trim", () => {
    // No yuva420p normaliser ahead of the trim, as at scale 1: the
    // normaliser converts to whatever alpha format premultiply takes, and
    // the explicit premultiply/unpremultiply run on every frame, whatever
    // its format (see animationChainHead).
    const { filterComplex } = buildCommand(layersEffie(), 0.25);
    expect(filterComplex).toContain(
      `[3:v]trim=start=0:duration=1.5,scale=w=iw:h=ih:eval=init,premultiply=inplace=1,${scale("0.25")},unpremultiply=inplace=1,setsar=1,setpts=PTS-STARTPTS[seg0_layer2]`,
    );
    expect(filterComplex).not.toContain("format=yuva420p,trim");
  });

  test("layer inputs are unchanged by scaling", () => {
    const layerInputs = (scale: number) =>
      buildCommand(layersEffie(), scale).inputs.filter(
        (input) => input.type !== "color",
      );
    expect(layerInputs(0.5)).toHaveLength(3);
    expect(layerInputs(0.5)).toEqual(layerInputs(1));
  });

  test("premultiplying image layers is left to FFmpeg, so a JPEG layer isn't premultiplied", () => {
    // No explicit premultiply filter on image layers, which would convert
    // every image, including an opaque JPEG, to a full-size alpha format
    // first. The alpha_modes of the format filters only make FFmpeg
    // premultiply frames that have an alpha channel, so the PNG and the JPEG
    // layer get the same chain, and only the PNG is premultiplied when the
    // graph runs (see the integration tests).
    const { filterComplex } = buildCommand(layersEffie(), 0.5);
    const imageChains = filterComplex
      .split(";")
      .filter((part) => /^\[[12]:v\]/.test(part));
    expect(imageChains).toHaveLength(2);
    for (const chain of imageChains) {
      expect(chain).not.toMatch(/premultiply=/);
    }
    expect(filterComplex).toContain(
      `[2:v]${scaleFilters("0.5")},format=yuva420p,loop=loop=-1:size=1,trim=start=0:duration=2,setsar=1,setpts=PTS-STARTPTS[seg0_layer1]`,
    );
  });

  test("at scale 1 layers aren't scaled", () => {
    const { filterComplex } = buildCommand(layersEffie(), 1);
    expect(filterComplex).not.toContain("alpha_modes");
    expect(filterComplex).toContain(
      "[1:v]format=yuva420p,loop=loop=-1:size=1,trim=start=0:duration=2,fade=t=in:st=0:d=1:alpha=1,setsar=1,setpts=PTS-STARTPTS[seg0_layer0]",
    );
    // The animation keeps its yuva420p normaliser ahead of the trim.
    expect(filterComplex).toContain(
      "[3:v]scale=w=iw:h=ih:eval=init,format=yuva420p,trim=start=0:duration=1.5,setsar=1,setpts=PTS-STARTPTS[seg0_layer2]",
    );
    expect(filterComplex).not.toMatch(/premultiply|trunc/);
  });

  test("a shake layer's intensity is scaled with the layers", () => {
    const effie = layersEffie();
    effie.segments[0].layers[1].motion = { type: "shake", intensity: 12 };
    const overlayX = (scale: number) =>
      buildCommand(effie, scale).filterComplex.match(
        /\[seg0_layer1\]overlay=x='round\(if\(lt\(t,0\),0,if\(lt\(t,1\),([^*]+)\*sin/,
      )?.[1];
    expect(overlayX(1)).toBe("12");
    expect(overlayX(0.5)).toBe("6");
    expect(overlayX(0.25)).toBe("3");
  });
});

describe("EffieRenderer opaque base layers", () => {
  // A layer that's opaque and covers the frame for the whole segment becomes
  // the segment's base: it's converted to yuv420p and replaces the
  // background, instead of being converted to yuva420p and overlaid on it.
  // Whether a source is opaque is only known once it's fetched, so the
  // command builds the graph from the input info FFmpegRunner reads.
  type Command = {
    inputs: { index: number; preArgs: string[]; type: string }[];
    filterComplex: string;
    filterComplexBuilder: (info: Map<number, FFmpegInputInfo>) => string;
  };

  function buildCommand(effie: EffieData<EffieSources>, scale = 1): Command {
    const renderer = new EffieRenderer(effie);
    return (
      renderer as unknown as {
        buildFFmpegCommand: (out: string, scale: number) => Command;
      }
    ).buildFFmpegCommand("out.mp4", scale);
  }

  type Layer = EffieData<EffieSources>["segments"][0]["layers"][0];

  function effie(...layers: Layer[]): EffieData<EffieSources> {
    return {
      width: 100,
      height: 100,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "black" },
      segments: [
        { duration: 2, layers },
        {
          duration: 1,
          layers: [{ type: "image", source: "https://example.com/card.png" }],
        },
      ],
    };
  }

  const photo: Layer = {
    type: "image",
    source: "https://example.com/photo.jpg",
    effects: [
      { type: "scroll", direction: "left", distance: 0.2, duration: 2 },
    ],
  };
  const caption: Layer = {
    type: "animation",
    source: "https://example.com/caption.tar",
    delay: 1,
  };
  const opaque = (width = 120, height = 100) => ({
    width,
    height,
    opaque: true,
  });
  const baseProps = "setparams=colorspace=unknown,sidedata=mode=delete";

  function graph(
    layers: Layer[],
    info: Record<number, FFmpegInputInfo>,
    scale = 1,
  ): string {
    const command = buildCommand(effie(...layers), scale);
    return command.filterComplexBuilder(
      new Map(Object.entries(info).map(([i, v]) => [Number(i), v])),
    );
  }

  test("without input info the graph overlays every layer", () => {
    const command = buildCommand(effie(photo, caption));
    expect(command.filterComplexBuilder(new Map())).toBe(command.filterComplex);
    expect(command.filterComplex).toContain(
      "[bg_seg0][seg0_layer0]overlay=0:0",
    );
  });

  test("the graph can be built more than once", () => {
    const e = effie(photo, caption);
    e.segments[1].audio = { source: "https://example.com/voice.mp3" };
    const command = buildCommand(e);
    expect(command.filterComplexBuilder(new Map())).toBe(command.filterComplex);
    expect(command.filterComplex).toContain("[4:a]apad");
  });

  test("an opaque, frame-covering image replaces the background", () => {
    // Inputs: 0 colour, 1 photo, 2 caption, 3 card
    const g = graph([photo, caption], { 1: opaque() });
    expect(g).toContain(
      `[1:v]format=yuv420p,loop=loop=-1:size=1,trim=start=0:duration=2,scroll=h=0.002777777777777778,crop=100:100:0:0,setsar=1,setpts=PTS-STARTPTS,fps=30,${baseProps}[seg0_tmp0]`,
    );
    expect(g).not.toContain("seg0_layer0");
    expect(g).not.toContain("bg_seg0");
    // The caption is overlaid on the base layer.
    expect(g).toContain("[seg0_tmp0][delayed_seg0_layer1]overlay=0:0");
    // Only the second segment still uses the global background.
    expect(g).toContain(
      "[0:v]fps=30,scale=100x100:force_original_aspect_ratio=increase,crop=100:100,setsar=1,split=1[bg_split_0]",
    );
    expect(g).toContain(
      "[bg_split_0]trim=start=2:duration=1,setpts=PTS-STARTPTS[bg_seg1]",
    );
  });

  test("an opaque animation holds its last frame to the end of the segment", () => {
    const zoom: Layer = { type: "animation", source: "https://example.com/z" };
    const g = graph([zoom], { 1: opaque(100, 100) });
    expect(g).toContain(
      `[1:v]scale=w=iw:h=ih:eval=init,format=yuv420p,trim=start=0:duration=2,crop=100:100:0:0,setsar=1,setpts=PTS-STARTPTS,fps=30,tpad=stop=-1:stop_mode=clone,trim=duration=2,fps=30,${baseProps}[seg0_tmp0]`,
    );
  });

  test("in a scaled render the base layer is scaled like an overlaid one", () => {
    const zoom: Layer = { type: "animation", source: "https://example.com/z" };
    const scale = `scale=w='max(1,trunc(iw*0.5))':h='max(1,trunc(ih*0.5))'`;
    const g = graph([zoom, photo], { 1: opaque(), 2: opaque() }, 0.5);
    // The photo is the topmost covering layer; the animation beneath it is
    // left out.
    expect(g).not.toContain("[1:v]");
    expect(g).toContain(
      `[2:v]format=alpha_modes=premultiplied,${scale},format=alpha_modes=straight,format=yuv420p,loop=loop=-1:size=1,trim=start=0:duration=2,scroll=h=0.002777777777777778,crop=50:50:0:0,`,
    );
    const anim = graph([zoom], { 1: opaque() }, 0.5);
    expect(anim).toContain(
      `[1:v]trim=start=0:duration=2,scale=w=iw:h=ih:eval=init,premultiply=inplace=1,${scale},unpremultiply=inplace=1,format=yuv420p,crop=50:50:0:0,`,
    );
  });

  test("layers that might not cover the frame are overlaid", () => {
    const overlaid = (layer: Layer, info: FFmpegInputInfo) =>
      graph([layer], { 1: info }).includes("[bg_seg0]");
    expect(overlaid(photo, opaque())).toBe(false);
    // Transparent, or smaller than the frame
    expect(overlaid(photo, { width: 120, height: 100, opaque: false })).toBe(
      true,
    );
    expect(overlaid(photo, opaque(99, 100))).toBe(true);
    expect(overlaid(photo, opaque(100, 99))).toBe(true);
    // Not there for the whole segment
    expect(overlaid({ ...photo, delay: 0.5 }, opaque())).toBe(true);
    expect(overlaid({ ...photo, from: 0.5 }, opaque())).toBe(true);
    expect(overlaid({ ...photo, until: 1.5 }, opaque())).toBe(true);
    expect(overlaid({ ...photo, until: 2 }, opaque())).toBe(false);
    // Moving, or fading
    expect(overlaid({ ...photo, motion: { type: "bounce" } }, opaque())).toBe(
      true,
    );
    expect(
      overlaid(
        { ...photo, effects: [{ type: "fade-in", start: 0, duration: 1 }] },
        opaque(),
      ),
    ).toBe(true);
    expect(
      overlaid(
        { ...photo, effects: [{ type: "saturate-in", start: 0, duration: 1 }] },
        opaque(),
      ),
    ).toBe(false);
  });

  test("a covered segment background is left out", () => {
    const e = effie(photo);
    e.segments[0].background = { type: "color", color: "white" };
    const command = buildCommand(e);
    // Inputs: 0 colour, 1 segment background, 2 photo, 3 card
    const g = command.filterComplexBuilder(new Map([[2, opaque()]]));
    expect(command.filterComplex).toContain("[1:v]");
    expect(g).not.toContain("[1:v]");
    expect(g).toContain("[2:v]format=yuv420p");
  });

  test("a video or image background is never replaced", () => {
    // Their frames' colour properties reach the output and set the colour
    // conversion of the layers above, so the layer stays overlaid.
    const backgrounds: EffieData<EffieSources>["background"][] = [
      { type: "video", source: "https://example.com/bg.mp4" },
      { type: "image", source: "https://example.com/bg.jpg" },
    ];
    for (const background of backgrounds) {
      const segmentBg = effie(photo);
      segmentBg.segments[0].background = background;
      // Inputs: 0 colour, 1 segment background, 2 photo, 3 card
      const command = buildCommand(segmentBg);
      expect(command.filterComplexBuilder(new Map([[2, opaque()]]))).toBe(
        command.filterComplex,
      );

      const globalBg = { ...effie(photo), background };
      // Inputs: 0 global background, 1 photo, 2 card
      const global = buildCommand(globalBg);
      expect(global.filterComplexBuilder(new Map([[1, opaque()]]))).toBe(
        global.filterComplex,
      );
    }
  });

  test("the global background is left out when every segment has a base layer", () => {
    const e = effie(photo);
    e.segments[1].layers = [{ ...photo, effects: undefined }];
    const command = buildCommand(e);
    const g = command.filterComplexBuilder(
      new Map([
        [1, opaque()],
        [2, opaque()],
      ]),
    );
    expect(g).not.toContain("[0:v]");
    expect(g).not.toContain("split");
    expect(g).toContain(
      `[2:v]format=yuv420p,loop=loop=-1:size=1,trim=start=0:duration=1,crop=100:100:0:0,setsar=1,setpts=PTS-STARTPTS,fps=30,${baseProps}[seg1_tmp0]`,
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

describe("EffieRenderer HTTP proxy", () => {
  const audioUrl = "https://example.com/audio.mp3";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Renders with FFmpegRunner.run stubbed out, and returns what the renderer
   * would have FFmpeg open for audioUrl, with the stubbed output stream.
   */
  async function render(options?: EffieRendererOptions) {
    const output = new PassThrough();
    const run = vi
      .spyOn(FFmpegRunner.prototype, "run")
      .mockResolvedValue(output);
    const renderer = new EffieRenderer(makeEffie({}), options);
    await renderer.render();
    const urlTransformer = run.mock.calls[0][2];
    return {
      renderer,
      output,
      ffmpegUrl: urlTransformer ? urlTransformer(audioUrl) : audioUrl,
    };
  }

  async function isListening(url: string): Promise<boolean> {
    return fetch(url).then(
      () => true,
      () => false,
    );
  }

  test("without a proxy, each render routes URLs through its own", async () => {
    const { output, ffmpegUrl } = await render();
    expect(ffmpegUrl).toMatch(
      new RegExp(`^http://127\\.0\\.0\\.1:\\d+/${audioUrl}$`),
    );
    const proxyUrl = new URL(ffmpegUrl).origin + "/";
    expect(await isListening(proxyUrl)).toBe(true);

    // Closed once the output is done.
    output.destroy();
    await new Promise((resolve) => output.once("close", resolve));
    expect(await isListening(proxyUrl)).toBe(false);
  });

  test("close() closes the render's own proxy", async () => {
    const { renderer, ffmpegUrl } = await render();
    renderer.close();
    expect(await isListening(new URL(ffmpegUrl).origin + "/")).toBe(false);
  });

  test("a given proxy is used and left open", async () => {
    const httpProxy = new HttpProxy();
    await httpProxy.start();
    try {
      const { renderer, output, ffmpegUrl } = await render({ httpProxy });
      expect(ffmpegUrl).toBe(httpProxy.transformUrl(audioUrl));
      output.destroy();
      await new Promise((resolve) => output.once("close", resolve));
      renderer.close();
      expect(await isListening(new URL(ffmpegUrl).origin + "/")).toBe(true);
    } finally {
      httpProxy.close();
    }
  });

  test("the render's own proxy is closed when the render fails", async () => {
    vi.spyOn(FFmpegRunner.prototype, "run").mockRejectedValue(
      new Error("fetch failed"),
    );
    const close = vi.spyOn(HttpProxy.prototype, "close");
    const renderer = new EffieRenderer(makeEffie({}));
    await expect(renderer.render()).rejects.toThrow("fetch failed");
    expect(close).toHaveBeenCalledOnce();
  });

  test("with httpProxy: false, FFmpeg opens URLs itself", async () => {
    const { ffmpegUrl } = await render({ httpProxy: false });
    expect(ffmpegUrl).toBe(audioUrl);
  });

  test("close() while the render's own proxy starts stops the render", async () => {
    const renderer = new EffieRenderer(makeEffie({}));
    const start = HttpProxy.prototype.start;
    vi.spyOn(HttpProxy.prototype, "start").mockImplementation(async function (
      this: HttpProxy,
    ) {
      renderer.close();
      await start.call(this);
    });
    const close = vi.spyOn(HttpProxy.prototype, "close");
    await expect(renderer.render()).rejects.toThrow("FFmpegRunner is closed");
    expect(close).toHaveBeenCalledOnce();
  });

  test("close() stops every render in progress", async () => {
    const outputs = [new PassThrough(), new PassThrough()];
    const run = vi.spyOn(FFmpegRunner.prototype, "run");
    for (const output of outputs) run.mockResolvedValueOnce(output);
    const closeRunner = vi.spyOn(FFmpegRunner.prototype, "close");
    const renderer = new EffieRenderer(makeEffie({}));
    await Promise.all([renderer.render(), renderer.render()]);
    const proxyUrls = run.mock.calls.map(
      ([, , urlTransformer]) => new URL(urlTransformer!(audioUrl)).origin + "/",
    );

    renderer.close();
    expect(closeRunner).toHaveBeenCalledTimes(2);
    for (const proxyUrl of proxyUrls) {
      expect(await isListening(proxyUrl)).toBe(false);
    }
  });

  test("destroying the output stops FFmpeg", async () => {
    // As the server does when a client aborts a streamed render: the output
    // closes before the renderer does.
    const closeRunner = vi.spyOn(FFmpegRunner.prototype, "close");
    const { output } = await render();
    output.destroy();
    await new Promise((resolve) => output.once("close", resolve));
    expect(closeRunner).toHaveBeenCalledOnce();
  });
});
