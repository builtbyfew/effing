import { describe, expect, test } from "vitest";
import { defaultOutputPath, targetUrl } from "./render";

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
    expect(defaultOutputPath("image", "cover", "image/webp")).toBe(
      "cover.webp",
    );
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
