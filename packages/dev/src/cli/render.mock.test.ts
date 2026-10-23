import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadConfig } from "../config/load";
import { startDevServer } from "../server/dev/host";
import { runRender } from "./render";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

vi.mock("../config/load", () => ({ loadConfig: vi.fn() }));

// What BASE_URL was when the workers were prewarmed: fns read it.
const prewarmedWith = vi.hoisted(() => [] as (string | undefined)[]);

vi.mock("../server/dev/host", () => ({
  startDevServer: vi.fn(async () => ({
    port: 3839,
    prewarm: vi.fn(() => prewarmedWith.push(process.env.BASE_URL)),
    close: vi.fn(),
  })),
}));

vi.mock("./env", () => ({
  applyDotenv: vi.fn(),
  ensureSecretKey: vi.fn(() => ({ secretKey: "secret", generated: true })),
}));

describe("runRender for effies", () => {
  let configDir: string;

  beforeEach(() => {
    // renderEffie looks for the project-local ffs bin before spawning it.
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), "effing-render-"));
    fs.mkdirSync(path.join(configDir, "node_modules/.bin"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(configDir, "node_modules/.bin/ffs"), "");
    vi.mocked(loadConfig).mockResolvedValue({
      config: { project: "test" },
      configDir,
    } as Awaited<ReturnType<typeof loadConfig>>);
    vi.mocked(spawn).mockImplementation(() => {
      const child = new EventEmitter();
      setImmediate(() => child.emit("close", 0));
      return child as ReturnType<typeof spawn>;
    });
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    // runRender schedules a process.exit to time-box lingering handles.
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    vi.stubEnv("BASE_URL", undefined);
    prewarmedWith.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  test("passes its options through to ffs render", async () => {
    await runRender("effie", "video", {
      output: "out.mp4",
      scale: 0.5,
      skipValidation: true,
      allowLocalFiles: true,
    });

    expect(spawn).toHaveBeenCalledOnce();
    const [bin, args] = vi.mocked(spawn).mock.calls[0];
    expect(bin).toBe(path.join(configDir, "node_modules/.bin/ffs"));
    expect(args).toEqual([
      "render",
      expect.stringMatching(/\/preview\/effie\/video\.json\?/),
      "out.mp4",
      "--scale",
      "0.5",
      "--skip-validation",
      "--allow-local-files",
    ]);
  });

  test("prewarms the app workers once BASE_URL points at the server", async () => {
    await runRender("effie", "video", { output: "out.mp4" });

    expect(prewarmedWith).toEqual(["http://127.0.0.1:3839"]);
  });

  test("stops app workers once idle", async () => {
    await runRender("effie", "video", { output: "out.mp4" });
    expect(startDevServer).toHaveBeenCalledWith(
      expect.objectContaining({ idleWorkerTimeout: expect.any(Number) }),
    );
  });

  test("reports a missing ffs before starting (and prewarming) the server", async () => {
    fs.rmSync(path.join(configDir, "node_modules/.bin/ffs"));

    await expect(
      runRender("effie", "video", { output: "out.mp4" }),
    ).rejects.toThrow(/requires the @effing\/ffs package/);

    expect(startDevServer).not.toHaveBeenCalled();
    expect(prewarmedWith).toEqual([]);
  });
});
