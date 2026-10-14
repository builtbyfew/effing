import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startDevServer } from "./host";

// Starts a real dev server on a throwaway project, so it needs @effing/dev
// built (the preview app and the annie worker live in dist/), as in CI.

const schema = `export const propsSchema = {
  safeParse: () => ({ success: true }),
  parse: (value: unknown) => value,
};
export const previewProps = {};
`;

const FILES: Record<string, string> = {
  "tsconfig.json": `{ "compilerOptions": { "jsx": "react-jsx" } }\n`,
  "shared.ts": `export const COLOR = "red";\n`,
  // Only the worker evaluates shared.ts for this annie: the main thread
  // loads the module but never runs its runner.
  "annies/dynamic.fn.tsx": `${schema}
import { isMainThread } from "node:worker_threads";
export async function* runner() {
  const { COLOR } = await import("../shared");
  yield Buffer.from(\`\${COLOR}:\${isMainThread ? "main" : "worker"}\`);
}
`,
  "effies/static.fn.tsx": `${schema}
import { COLOR } from "../shared";
export async function runner() {
  return { color: COLOR };
}
`,
};

let dir: string;
let server: { port: number; close: () => Promise<void> };
let base: string;
const savedEnv = { ...process.env };

beforeAll(async () => {
  // realpath: on macOS the temp dir is behind a symlink, and the watcher
  // reports real paths.
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "effing-host-")));
  for (const [file, source] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), source);
  }
  server = await startDevServer({
    configDir: dir,
    config: {
      project: "host-test",
      annies: "annies/*.fn.tsx",
      effies: "effies/*.fn.tsx",
      dev: { workers: 1 },
    },
    host: "127.0.0.1",
    port: 4987,
  });
  base = `http://127.0.0.1:${server.port}`;
  process.env.BASE_URL = base;
  process.env.SECRET_KEY = "host-test-secret";
}, 30_000);

afterAll(async () => {
  await server?.close();
  process.env = savedEnv;
  fs.rmSync(dir, { recursive: true, force: true });
});

/** The frames of an annie TAR, as text. */
async function annie(): Promise<string[]> {
  const response = await fetch(`${base}/preview/annie/dynamic.tar?w=10&h=10`);
  expect(response.status).toBe(200);
  const tar = Buffer.from(await response.arrayBuffer());
  const frames: string[] = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const size = parseInt(
      tar.subarray(offset + 124, offset + 136).toString(),
      8,
    );
    if (!size) break;
    frames.push(tar.subarray(offset + 512, offset + 512 + size).toString());
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return frames;
}

async function effie(): Promise<string> {
  const response = await fetch(`${base}/preview/effie/static.json?w=10&h=10`);
  expect(response.status).toBe(200);
  return ((await response.json()) as { color: string }).color;
}

function editShared(color: string) {
  fs.writeFileSync(
    path.join(dir, "shared.ts"),
    `export const COLOR = "${color}";\n`,
  );
}

describe("startDevServer with annie workers", () => {
  test("renders annies on a worker", async () => {
    expect(await annie()).toEqual(["red:worker"]);
    expect(await effie()).toBe("red");
  });

  test("picks up an edit on the main thread after a worker fetched it first", async () => {
    editShared("blue");
    await expect.poll(annie, { timeout: 10_000 }).toEqual(["blue:worker"]);
    expect(await effie()).toBe("blue");
  });

  test("picks up an edit on a worker after the main thread fetched it first", async () => {
    editShared("green");
    await expect.poll(effie, { timeout: 10_000 }).toBe("green");
    expect(await annie()).toEqual(["green:worker"]);
  });
});
