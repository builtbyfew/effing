import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { startDevServer } from "./host";

// Starts real dev servers on throwaway projects, so it needs @effing/dev
// built (the preview app, the app worker and the CLI live in dist/), as in CI.

const CLI = fileURLToPath(
  new URL("../../../dist/cli/index.js", import.meta.url),
);

const schema = `export const propsSchema = {
  safeParse: () => ({ success: true }),
  parse: (value: unknown) => value,
};
export const previewProps = {};
`;

// The fns wait a little before answering, so that requests made together
// overlap.
const FILES: Record<string, string> = {
  "tsconfig.json": `{ "compilerOptions": { "jsx": "react-jsx" } }\n`,
  "shared.ts": `export const COLOR = "red";\n`,
  "annies/color.fn.tsx": `${schema}
import { threadId } from "node:worker_threads";
import { COLOR } from "../shared";
export async function* runner() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  yield Buffer.from(JSON.stringify({ color: COLOR, thread: threadId }));
}
`,
  "effies/color.fn.tsx": `${schema}
import { threadId } from "node:worker_threads";
import { COLOR } from "../shared";
export async function runner() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { color: COLOR, thread: threadId, baseUrl: process.env.BASE_URL };
}
`,
};

type Rendered = { color: string; thread: number; baseUrl?: string };

function writeProject(files: Record<string, string>): string {
  // realpath: on macOS the temp dir is behind a symlink, and the watcher
  // reports real paths.
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "effing-host-")),
  );
  for (const [file, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), source);
  }
  return dir;
}

/** A dev server with `workers` on a throwaway project, for one describe. */
function useProject(workers: number) {
  let dir: string;
  let server: { port: number; close: () => Promise<void> };
  let base: string;

  beforeAll(async () => {
    dir = writeProject(FILES);
    vi.stubEnv("SECRET_KEY", "host-test-secret");
    server = await startDevServer({
      configDir: dir,
      config: {
        project: "host-test",
        annies: "annies/*.fn.tsx",
        effies: "effies/*.fn.tsx",
        dev: { workers },
      },
      host: "127.0.0.1",
      port: 4987,
    });
    base = `http://127.0.0.1:${server.port}`;
    vi.stubEnv("BASE_URL", base);
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** The annie's only frame. */
  const annie = async (): Promise<Rendered> => {
    const response = await fetch(`${base}/preview/annie/color.tar?w=10&h=10`);
    expect(response.status).toBe(200);
    const tar = Buffer.from(await response.arrayBuffer());
    const size = parseInt(tar.subarray(124, 136).toString(), 8);
    return JSON.parse(tar.subarray(512, 512 + size).toString()) as Rendered;
  };

  const effie = async (): Promise<Rendered> => {
    const response = await fetch(`${base}/preview/effie/color.json?w=10&h=10`);
    expect(response.status).toBe(200);
    return (await response.json()) as Rendered;
  };

  // Requested together, so with workers they go to different ones: the
  // second finds the first worker busy.
  const both = async (): Promise<[Rendered, Rendered]> => {
    const [a, e] = await Promise.all([annie(), effie()]);
    if (workers > 0) expect(a.thread).not.toBe(e.thread);
    return [a, e];
  };

  const editShared = async (color: string) => {
    // Vite's watcher (chokidar) drops a change to a path that comes within
    // 50ms of the previous one, and Linux reports edits fast enough for the
    // previous test's edit to be that close.
    await new Promise((resolve) => setTimeout(resolve, 200));
    fs.writeFileSync(
      path.join(dir, "shared.ts"),
      `export const COLOR = "${color}";\n`,
    );
  };

  return { base: () => base, annie, effie, both, editShared };
}

// Longer than the polls below; the first render also spawns the workers and
// transforms every module cold.
describe.each([2, 0])(
  "startDevServer with workers: %i",
  { timeout: 20_000 },
  (workers) => {
    const project = useProject(workers);

    if (workers > 0) {
      test("serves concurrent requests on different workers", async () => {
        const [a, e] = await project.both();
        expect([a.color, e.color]).toEqual(["red", "red"]);
        expect(a.thread).not.toBe(0);
        expect(e.thread).not.toBe(0);
      });
    }

    test("sees env vars set after the server started", async () => {
      // As `effing render` sets BASE_URL once the server is listening.
      const base = project.base();
      await project.effie(); // a worker is running, if any
      process.env.BASE_URL = `${base}/changed`;
      try {
        expect((await project.effie()).baseUrl).toBe(`${base}/changed`);
      } finally {
        process.env.BASE_URL = base;
      }
    });

    test("picks up an edit to an imported module", async () => {
      await project.editShared("blue");
      // With workers, a lone request goes to the first worker, which fetches
      // the edited module first; the second worker must not keep its old copy.
      await expect
        .poll(async () => (await project.annie()).color, { timeout: 10_000 })
        .toBe("blue");
      const [a, e] = await project.both();
      expect([a.color, e.color]).toEqual(["blue", "blue"]);

      await project.editShared("green");
      await expect
        .poll(async () => (await project.effie()).color, { timeout: 10_000 })
        .toBe("green");
      const [a2, e2] = await project.both();
      expect([a2.color, e2.color]).toEqual(["green", "green"]);
    });
  },
);

describe("effing dev", () => {
  test("exits when it fails to start", { timeout: 20_000 }, async () => {
    // A port that's taken, which fails startup once Vite is running.
    const taken = http.createServer();
    await new Promise<void>((resolve) =>
      taken.listen(0, "127.0.0.1", () => resolve()),
    );
    const { port } = taken.address() as { port: number };
    const dir = writeProject({
      "effing.config.ts": `export default { project: "host-test" };\n`,
    });
    const cli = spawn(
      process.execPath,
      [CLI, "dev", "--port", String(port), "--no-ffs"],
      { cwd: dir, stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    cli.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    try {
      // Without cleanup, Vite's watcher keeps the process running.
      const code = await new Promise<number | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 10_000);
        cli.on("exit", (exitCode) => {
          clearTimeout(timer);
          resolve(exitCode);
        });
      });
      expect(stderr).toContain("already in use");
      expect(code).toBe(1);
    } finally {
      cli.kill();
      taken.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
