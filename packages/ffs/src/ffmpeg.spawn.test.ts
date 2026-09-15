import { describe, test, expect } from "vitest";
import { finished } from "stream/promises";

// Point the runner at a binary that does not exist *before* the module
// resolves (and caches) it. Vitest isolates modules per test file, so this
// does not leak into the other ffmpeg tests.
process.env.FFMPEG = "/nonexistent/ffs-test/ffmpeg";

describe("FFmpegRunner spawn failures", () => {
  test("reports a missing binary through the output stream", async () => {
    const { FFmpegCommand, FFmpegRunner } = await import("./ffmpeg");
    const command = new FFmpegCommand(
      ["-y"],
      [
        {
          index: 0,
          source: "",
          preArgs: ["-f", "lavfi", "-i", "color=black:size=64x64:rate=30"],
          type: "color",
        },
      ],
      "[0:v]null[outv]",
      ["-map", "[outv]", "-f", "null", "-"],
    );
    const runner = new FFmpegRunner(command);

    // spawn() itself does not throw for ENOENT; the failure must arrive as an
    // error on the returned stream rather than an unhandled `error` event.
    const output = await runner.run(async () => {
      throw new Error("no sources expected");
    });
    output.resume();
    await expect(finished(output)).rejects.toMatchObject({ code: "ENOENT" });
    runner.close();
  });
});
