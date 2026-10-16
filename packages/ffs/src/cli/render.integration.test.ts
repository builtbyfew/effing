import { describe, test, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { parseArgs, runRender, type RenderArgs } from "./render";

let dir: string;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ffs-cli-render-"));
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function args(
  input: string,
  output: string,
  overrides: Partial<RenderArgs> = {},
): RenderArgs {
  return {
    input,
    output,
    scale: 1,
    skipValidation: false,
    allowLocalFiles: false,
    ...overrides,
  };
}

// A 1x1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

async function writeLocalFileEffie(
  name: string,
  cover = "https://example.com/cover.png",
): Promise<string> {
  const imagePath = path.join(dir, `${name}.png`);
  await fs.writeFile(imagePath, PNG);
  const inputPath = path.join(dir, `${name}.json`);
  const effie = {
    width: 160,
    height: 120,
    fps: 30,
    cover,
    background: { type: "color", color: "blue" },
    segments: [
      {
        duration: 0.3,
        layers: [
          { type: "image", source: pathToFileURL(imagePath).toString() },
        ],
      },
    ],
  };
  await fs.writeFile(inputPath, JSON.stringify(effie));
  return inputPath;
}

describe("ffs render CLI", () => {
  test("renders a composition from a local JSON file to MP4", async () => {
    const inputPath = path.join(dir, "effie.json");
    const outputPath = path.join(dir, "out.mp4");
    const effie = {
      width: 160,
      height: 120,
      fps: 30,
      cover: "https://example.com/cover.png",
      background: { type: "color", color: "blue" },
      segments: [{ duration: 0.3, layers: [] }],
    };
    await fs.writeFile(inputPath, JSON.stringify(effie));

    await runRender(args(inputPath, outputPath));

    const bytes = await fs.readFile(outputPath);
    expect(bytes.byteLength).toBeGreaterThan(0);
    // MP4 files start with a "ftyp" box at offset 4
    expect(bytes.slice(4, 8).toString("ascii")).toBe("ftyp");
  });

  test("rejects invalid JSON input", async () => {
    const inputPath = path.join(dir, "bad.json");
    await fs.writeFile(inputPath, "{ not json");
    await expect(
      runRender(args(inputPath, path.join(dir, "bad.mp4"))),
    ).rejects.toThrow(/Failed to parse JSON/);
  });

  test("rejects effie that fails schema validation", async () => {
    const inputPath = path.join(dir, "invalid.json");
    await fs.writeFile(inputPath, JSON.stringify({ not: "effie" }));
    await expect(
      runRender(args(inputPath, path.join(dir, "invalid.mp4"))),
    ).rejects.toThrow(/Invalid effie data/);
  });

  test("renders file: sources with --allow-local-files and validation on", async () => {
    const inputPath = await writeLocalFileEffie("local");
    const outputPath = path.join(dir, "local.mp4");

    await runRender(args(inputPath, outputPath, { allowLocalFiles: true }));

    const bytes = await fs.readFile(outputPath);
    expect(bytes.slice(4, 8).toString("ascii")).toBe("ftyp");
  });

  test("rejects file: sources without --allow-local-files", async () => {
    const inputPath = await writeLocalFileEffie("local-denied");
    await expect(
      runRender(args(inputPath, path.join(dir, "local-denied.mp4"))),
    ).rejects.toThrow(/Invalid effie data\n {2}segments\.0\.layers\.0\.source/);
  });

  test("rejects a file: cover even with --allow-local-files", async () => {
    const imagePath = path.join(dir, "cover.png");
    const inputPath = await writeLocalFileEffie(
      "local-cover",
      pathToFileURL(imagePath).toString(),
    );
    // The cover is the only issue: the file: layer source passes.
    await expect(
      runRender(
        args(inputPath, path.join(dir, "local-cover.mp4"), {
          allowLocalFiles: true,
        }),
      ),
    ).rejects.toThrow(/^Invalid effie data\n {2}cover: [^\n]*$/);
  });

  test("parseArgs reports missing positionals", () => {
    expect(parseArgs([])).toMatchObject({ kind: "error" });
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseArgs(["a", "b", "--scale", "2"])).toEqual({
      kind: "args",
      args: {
        input: "a",
        output: "b",
        scale: 2,
        skipValidation: false,
        allowLocalFiles: false,
      },
    });
    expect(parseArgs(["a", "b", "--scale", "no"])).toMatchObject({
      kind: "error",
    });
  });
});
