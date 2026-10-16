import { describe, expect, test } from "vitest";
import {
  defaultOutputPath,
  ffsRenderArgs,
  runRender,
  targetUrl,
} from "./render";

describe("defaultOutputPath", () => {
  test("effie renders to mp4", () => {
    expect(defaultOutputPath("effie", "my-video")).toBe("my-video.mp4");
  });

  test("annie renders to tar", () => {
    expect(defaultOutputPath("annie", "my-animation")).toBe("my-animation.tar");
  });

  test("image extension follows content type", () => {
    expect(defaultOutputPath("image", "cover", "image/jpeg")).toBe("cover.jpg");
    expect(defaultOutputPath("image", "cover", "image/png")).toBe("cover.png");
  });

  test("image content type with charset parameter still matches", () => {
    expect(
      defaultOutputPath("image", "cover", "image/jpeg; charset=binary"),
    ).toBe("cover.jpg");
  });

  test("image falls back to png for unknown or missing content type", () => {
    expect(defaultOutputPath("image", "cover")).toBe("cover.png");
    expect(
      defaultOutputPath("image", "cover", "application/octet-stream"),
    ).toBe("cover.png");
  });
});

describe("targetUrl", () => {
  const base = "http://127.0.0.1:3839";
  const bounds = { width: 1080, height: 1920 };

  test("without props uses the unsigned preview endpoint per kind", async () => {
    await expect(
      targetUrl(base, "image", "cover", undefined, bounds, "secret"),
    ).resolves.toBe(`${base}/preview/image/cover.bytes?w=1080&h=1920`);
    await expect(
      targetUrl(base, "annie", "anim", undefined, bounds, "secret"),
    ).resolves.toBe(`${base}/preview/annie/anim.tar?w=1080&h=1920`);
    await expect(
      targetUrl(base, "effie", "video", undefined, bounds, "secret"),
    ).resolves.toBe(`${base}/preview/effie/video.json?w=1080&h=1920`);
  });

  test("with props mints a signed segment", async () => {
    const url = await targetUrl(
      base,
      "effie",
      "video",
      { title: "hi" },
      bounds,
      "secret",
    );
    expect(url).toMatch(new RegExp(`^${base}/effie/[^/?]+$`));
  });
});

describe("ffsRenderArgs", () => {
  const url = "http://127.0.0.1:3839/preview/effie/video.json?w=1080&h=1920";

  test("passes only url and output by default", () => {
    expect(ffsRenderArgs(url, "out.mp4")).toEqual(["render", url, "out.mp4"]);
    expect(
      ffsRenderArgs(url, "out.mp4", {
        scale: 1,
        skipValidation: false,
        allowLocalFiles: false,
      }),
    ).toEqual(["render", url, "out.mp4"]);
  });

  test("passes --scale when it isn't 1", () => {
    expect(ffsRenderArgs(url, "out.mp4", { scale: 0.5 })).toEqual([
      "render",
      url,
      "out.mp4",
      "--scale",
      "0.5",
    ]);
  });

  test("passes --skip-validation when given", () => {
    expect(ffsRenderArgs(url, "out.mp4", { skipValidation: true })).toEqual([
      "render",
      url,
      "out.mp4",
      "--skip-validation",
    ]);
  });

  test("passes --allow-local-files when given", () => {
    expect(ffsRenderArgs(url, "out.mp4", { allowLocalFiles: true })).toEqual([
      "render",
      url,
      "out.mp4",
      "--allow-local-files",
    ]);
  });
});

describe("runRender", () => {
  test.each([
    ["--scale", { scale: 2 }],
    ["--skip-validation", { skipValidation: true }],
    ["--allow-local-files", { allowLocalFiles: true }],
  ])("rejects %s for non-effie kinds", async (flag, options) => {
    for (const kind of ["image", "annie"]) {
      await expect(runRender(kind, "cover", options)).rejects.toThrow(
        `${flag} only applies to effie renders.`,
      );
    }
  });
});
