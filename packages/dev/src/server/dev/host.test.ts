import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startDevServer } from "./host";

// Starts a real dev server on a throwaway project, so it needs @effing/dev
// built (the preview app and the app worker live in dist/), as in CI.

const schema = `export const propsSchema = {
  safeParse: () => ({ success: true }),
  parse: (value: unknown) => value,
};
export const previewProps = {};
`;

const FILES: Record<string, string> = {
  "tsconfig.json": `{ "compilerOptions": { "jsx": "react-jsx" } }\n`,
  "shared.ts": `export const COLOR = "red";\n`,
  "annies/color.fn.tsx": `${schema}
import { threadId } from "node:worker_threads";
import { COLOR } from "../shared";
export async function* runner() {
  yield Buffer.from(JSON.stringify({ color: COLOR, thread: threadId }));
}
`,
  "effies/color.fn.tsx": `${schema}
import { threadId } from "node:worker_threads";
import { COLOR } from "../shared";
export async function runner() {
  return { color: COLOR, thread: threadId, baseUrl: process.env.BASE_URL };
}
`,
};

type Rendered = { color: string; thread: number; baseUrl?: string };

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
  process.env.SECRET_KEY = "host-test-secret";
  server = await startDevServer({
    configDir: dir,
    config: {
      project: "host-test",
      annies: "annies/*.fn.tsx",
      effies: "effies/*.fn.tsx",
      dev: { workers: 2 },
    },
    host: "127.0.0.1",
    port: 4987,
  });
  base = `http://127.0.0.1:${server.port}`;
  process.env.BASE_URL = base;
}, 30_000);

afterAll(async () => {
  await server?.close();
  process.env = savedEnv;
  fs.rmSync(dir, { recursive: true, force: true });
});

/** The annie's only frame. */
async function annie(): Promise<Rendered> {
  const response = await fetch(`${base}/preview/annie/color.tar?w=10&h=10`);
  expect(response.status).toBe(200);
  const tar = Buffer.from(await response.arrayBuffer());
  const size = parseInt(tar.subarray(124, 136).toString(), 8);
  return JSON.parse(tar.subarray(512, 512 + size).toString()) as Rendered;
}

async function effie(): Promise<Rendered> {
  const response = await fetch(`${base}/preview/effie/color.json?w=10&h=10`);
  expect(response.status).toBe(200);
  return (await response.json()) as Rendered;
}

// Requested together, so they go to different workers: the second finds the
// first worker busy.
async function both(): Promise<[Rendered, Rendered]> {
  const [a, e] = await Promise.all([annie(), effie()]);
  expect(a.thread).not.toBe(e.thread);
  return [a, e];
}

async function editShared(color: string) {
  // Vite's watcher (chokidar) drops a change to a path that comes within
  // 50ms of the previous one, and Linux reports edits fast enough for the
  // previous test's edit to be that close.
  await new Promise((resolve) => setTimeout(resolve, 200));
  fs.writeFileSync(
    path.join(dir, "shared.ts"),
    `export const COLOR = "${color}";\n`,
  );
}

// Longer than the polls below; the first render also spawns the workers and
// transforms every module cold.
describe("startDevServer with app workers", { timeout: 20_000 }, () => {
  test("serves concurrent requests on different workers", async () => {
    const [a, e] = await both();
    expect([a.color, e.color]).toEqual(["red", "red"]);
    expect(a.thread).not.toBe(0);
    expect(e.thread).not.toBe(0);
  });

  test("shares env vars set after the workers started", async () => {
    // As `effing render` sets BASE_URL once the server is listening.
    await effie(); // a worker is running
    process.env.BASE_URL = `${base}/changed`;
    try {
      expect((await effie()).baseUrl).toBe(`${base}/changed`);
    } finally {
      process.env.BASE_URL = base;
    }
  });

  test("picks up an edit on a worker after another fetched it first", async () => {
    await editShared("blue");
    // A lone request goes to the first worker, which fetches the edited
    // module first; the second worker must not keep its old copy.
    await expect
      .poll(async () => (await annie()).color, { timeout: 10_000 })
      .toBe("blue");
    const [a, e] = await both();
    expect([a.color, e.color]).toEqual(["blue", "blue"]);

    await editShared("green");
    await expect
      .poll(async () => (await effie()).color, { timeout: 10_000 })
      .toBe("green");
    const [a2, e2] = await both();
    expect([a2.color, e2.color]).toEqual(["green", "green"]);
  });
});
