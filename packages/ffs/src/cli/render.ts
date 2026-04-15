import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import { pipeline } from "stream/promises";
import { pathToFileURL } from "url";
import { EffieRenderer } from "../renderer";
import { ffsFetch } from "../fetch";
import { parseEffieData } from "../handlers/shared";
import { FetchError } from "../handlers/errors";

export type RenderArgs = {
  input: string;
  output: string;
  scale: number;
  skipValidation: boolean;
  allowLocalFiles: boolean;
};

export type ParseArgsResult =
  | { kind: "args"; args: RenderArgs }
  | { kind: "help" }
  | { kind: "error"; message: string };

export const USAGE = `Usage: ffs render <url-or-json-file> <output.mp4> [options]

Options:
  --scale <n>           Output scale factor (default: 1)
  --skip-validation     Skip Effie schema validation
  --allow-local-files   Allow file:// sources in the composition
  -h, --help            Show this help`;

export function parseArgs(argv: string[]): ParseArgsResult {
  const positional: string[] = [];
  let scale = 1;
  let skipValidation =
    !!process.env.FFS_SKIP_VALIDATION &&
    process.env.FFS_SKIP_VALIDATION !== "false";
  let allowLocalFiles = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      return { kind: "help" };
    } else if (arg === "--scale") {
      const value = argv[++i];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return {
          kind: "error",
          message: `--scale must be a positive number, got "${value}"`,
        };
      }
      scale = parsed;
    } else if (arg === "--skip-validation") {
      skipValidation = true;
    } else if (arg === "--allow-local-files") {
      allowLocalFiles = true;
    } else if (arg.startsWith("--")) {
      return { kind: "error", message: `Unknown option: ${arg}` };
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 2) {
    return {
      kind: "error",
      message: `Expected <url-or-json-file> and <output.mp4>, got ${positional.length} positional argument(s).\n\n${USAGE}`,
    };
  }

  return {
    kind: "args",
    args: {
      input: positional[0],
      output: positional[1],
      scale,
      skipValidation,
      allowLocalFiles,
    },
  };
}

async function loadEffieBody(input: string): Promise<unknown> {
  if (/^https?:\/\//i.test(input)) {
    const response = await ffsFetch(input);
    if (!response.ok) {
      throw new FetchError(input, response.status, response.statusText);
    }
    return response.json();
  }

  const path = input.startsWith("file://")
    ? new URL(input)
    : pathToFileURL(input);
  const raw = await readFile(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from ${input}: ${(error as Error).message}`,
    );
  }
}

export async function runRender(args: RenderArgs): Promise<void> {
  process.stderr.write(`fetching ${args.input}\n`);
  const body = await loadEffieBody(args.input);

  const parsed = parseEffieData(body, args.skipValidation);
  if ("error" in parsed) {
    const issues = parsed.issues
      ? "\n" + parsed.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")
      : "";
    throw new Error(`${parsed.error}${issues}`);
  }

  process.stderr.write(`rendering to ${args.output}\n`);
  const renderer = new EffieRenderer(parsed.effie, {
    allowLocalFiles: args.allowLocalFiles,
  });

  const start = Date.now();
  try {
    const videoStream = await renderer.render(args.scale);
    await pipeline(videoStream, createWriteStream(args.output));
  } finally {
    renderer.close();
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  process.stderr.write(`done in ${elapsed}s\n`);
}
