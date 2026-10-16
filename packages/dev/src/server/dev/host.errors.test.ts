import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { startDevServer } from "./host";

// Starts real dev servers on a throwaway project, so it needs @effing/dev
// built (the preview app and the app worker live in dist/), as in CI.

const schema = `export const propsSchema = {
  safeParse: () => ({ success: true }),
  parse: (value: unknown) => value,
};
export const previewProps = {};
`;

const FILES: Record<string, string> = {
  "tsconfig.json": `{ "compilerOptions": { "jsx": "react-jsx" } }\n`,
  "annies/ok.fn.tsx": `${schema}
export async function* runner() {
  yield Buffer.from("frame");
}
`,
};

// Fails once the client has its first bytes, which the test signals by
// creating `signal` (it gives up waiting after 10s).
const brokenAnnie = (signal: string) => `${schema}
import fs from "node:fs";
export async function* runner() {
  yield Buffer.from("frame");
  for (let i = 0; i < 1000 && !fs.existsSync(${JSON.stringify(signal)}); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("broken annie");
}
`;

describe.each([2, 0])(
  "startDevServer with workers: %i",
  { timeout: 20_000 },
  (workers) => {
    let dir: string;
    let server: { port: number; close: () => Promise<void> };
    let base: string;

    beforeAll(async () => {
      // realpath: on macOS the temp dir is behind a symlink, and the watcher
      // reports real paths.
      dir = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "effing-host-errors-")),
      );
      const files = {
        ...FILES,
        "annies/broken.fn.tsx": brokenAnnie(path.join(dir, "fail")),
      };
      for (const [file, source] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), source);
      }
      vi.stubEnv("SECRET_KEY", "host-test-secret");
      server = await startDevServer({
        configDir: dir,
        config: {
          project: "host-test",
          annies: "annies/*.fn.tsx",
          dev: { workers },
        },
        host: "127.0.0.1",
        port: 4997,
      });
      base = `http://127.0.0.1:${server.port}`;
      vi.stubEnv("BASE_URL", base);
    }, 30_000);

    afterAll(async () => {
      await server?.close();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      fs.rmSync(dir, { recursive: true, force: true });
    });

    const annie = (id: string) =>
      fetch(`${base}/preview/annie/${id}.tar?w=10&h=10`);

    test("aborts the response of an fn that fails mid-stream", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await annie("broken");
      expect(response.status).toBe(200);
      const reader = response.body!.getReader();
      expect((await reader.read()).done).toBe(false);
      fs.writeFileSync(path.join(dir, "fail"), "");
      // Aborted, not ended cleanly as a complete-looking TAR.
      await expect(
        (async () => {
          while (!(await reader.read()).done);
        })(),
      ).rejects.toThrow();

      // The dev server, or the worker that served it, carries on.
      const next = await annie("ok");
      expect(next.status).toBe(200);
      const tar = Buffer.from(await next.arrayBuffer());
      expect(tar.subarray(512, 517).toString()).toBe("frame");
      const logged = error.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(logged).not.toContain("App worker stopped");
      // A worker logs on its own stdio, so only this thread's log shows here.
      if (workers === 0) expect(logged).toContain("/preview/annie/broken.tar");
    });
  },
);
