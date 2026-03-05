import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock @napi-rs/canvas before any imports that use it
vi.mock("@napi-rs/canvas", () => {
  const mockRender = vi.fn();
  const mockSeekFrame = vi.fn();

  class MockLottieAnimation {
    render = mockRender;
    seekFrame = mockSeekFrame;
    frames = 30;
    fps = 30;
    duration = 1;
    width = 100;
    height = 100;

    static loadFromData = vi.fn((): MockLottieAnimation => {
      return new MockLottieAnimation();
    });
  }

  return {
    LottieAnimation: MockLottieAnimation,
  };
});

import { LottieAnimation } from "@napi-rs/canvas";
import type { SKRSContext2D } from "@napi-rs/canvas";

import { loadLottie, renderLottieFrame } from "./lottie.ts";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadLottie", () => {
  it("loads from a JSON string", () => {
    const json = JSON.stringify({ v: "5.0", fr: 30, w: 100, h: 100 });
    const anim = loadLottie(json);

    expect(LottieAnimation.loadFromData).toHaveBeenCalledWith(json, {
      resourcePath: undefined,
    });
    expect(anim).toBeInstanceOf(LottieAnimation);
  });

  it("loads from a Buffer", () => {
    const json = JSON.stringify({ v: "5.0", fr: 30, w: 100, h: 100 });
    const buf = Buffer.from(json);
    const anim = loadLottie(buf);

    expect(LottieAnimation.loadFromData).toHaveBeenCalledWith(json, {
      resourcePath: undefined,
    });
    expect(anim).toBeInstanceOf(LottieAnimation);
  });

  it("passes resourcePath option", () => {
    const json = "{}";
    loadLottie(json, { resourcePath: "/assets" });

    expect(LottieAnimation.loadFromData).toHaveBeenCalledWith(json, {
      resourcePath: "/assets",
    });
  });
});

describe("renderLottieFrame", () => {
  it("seeks to frame and renders to context", () => {
    const anim = loadLottie("{}");
    const ctx = {} as SKRSContext2D;

    renderLottieFrame(ctx, anim, 5);

    expect(anim.seekFrame).toHaveBeenCalledWith(5);
    expect(anim.render).toHaveBeenCalledWith(ctx);
  });

  it("renders frame 0", () => {
    const anim = loadLottie("{}");
    const ctx = {} as SKRSContext2D;

    renderLottieFrame(ctx, anim, 0);

    expect(anim.seekFrame).toHaveBeenCalledWith(0);
    expect(anim.render).toHaveBeenCalledWith(ctx);
  });
});
