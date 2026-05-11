import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { loadEnv } from "vite";
import { loadConfig } from "../config/load";
import { DEFAULT_DEV } from "../config/schema";
import { HOISTED_DEPS, startPreviewServer } from "../preview-server";

export type DevOptions = {
  config?: string;
  port?: number;
  host?: string;
  ffs?: boolean;
};

export async function runDev(options: DevOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { config, configDir, configPath } = await loadConfig(
    cwd,
    options.config,
  );
  console.log(`Loaded config from ${configPath}`);

  applyDotenv(configDir);

  const host = options.host ?? config.dev?.host ?? DEFAULT_DEV.host;
  const port = options.port ?? config.dev?.port ?? DEFAULT_DEV.port;
  const ffsEnabled = options.ffs ?? config.dev?.ffs ?? DEFAULT_DEV.ffs;

  const server = await startPreviewServer({ configDir, config, host, port });

  let ffsProc: ChildProcess | null = null;
  if (ffsEnabled) {
    ffsProc = startFfsSidecar(configDir);
  }

  console.log(`\nEffing dev server: http://${host}:${port}\n`);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      // Second Ctrl+C — give up on graceful shutdown.
      process.exit(1);
    }
    shuttingDown = true;
    if (ffsProc) ffsProc.kill(signal);
    // Don't await server.close() — let the process exit on its own once the
    // event loop drains. Vite + http.closeAllConnections handle the heavy
    // lifting; anything still hanging is a bug we'd rather diagnose than mask.
    server.close().finally(() => process.exit(0));
    // Belt-and-suspenders: hard exit if close() doesn't resolve in 2s.
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  // Belt-and-suspenders: clean up the staged preview dir if the process
  // exits abnormally (uncaught throw, etc.) before normal shutdown runs.
  process.on("exit", () => {
    try {
      fs.rmSync(path.join(configDir, ".effing-preview"), {
        recursive: true,
        force: true,
      });
    } catch {
      // ignore
    }
    // Best-effort sync cleanup of hoisted dep symlinks.
    for (const dep of HOISTED_DEPS) {
      try {
        const p = path.join(configDir, "node_modules", dep);
        if (fs.lstatSync(p).isSymbolicLink()) fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  });
}

/**
 * Load `.env`, `.env.local`, `.env.development`, `.env.development.local` from
 * the project root and merge them into `process.env`. Existing `process.env`
 * values take precedence (so explicit `FOO=bar pnpm dev` keeps working).
 */
function applyDotenv(projectRoot: string): void {
  const env = loadEnv("development", projectRoot, "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function startFfsSidecar(configDir: string): ChildProcess | null {
  const ffsBin = path.resolve(configDir, "node_modules/.bin/ffs");
  if (!fs.existsSync(ffsBin)) {
    console.log("FFS sidecar disabled (no @effing/ffs installed)");
    return null;
  }
  return spawn(ffsBin, [], {
    cwd: configDir,
    stdio: "inherit",
    env: process.env,
  });
}
