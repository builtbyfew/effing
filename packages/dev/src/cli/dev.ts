import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { loadEnv } from "vite";
import { loadConfig } from "../config/load";
import { DEFAULT_DEV } from "../config/schema";
import { startDevServer } from "../server/dev/host";
import { resolveBaseUrl } from "./base-url";
import { findFreePort } from "./ports";

const DEFAULT_FFS_PORT = 2000;

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
  // An explicitly chosen port (flag or config) is strict: a collision there
  // means another instance of this project is running, and silently moving
  // would mislead. Only the built-in default auto-walks to a free port.
  const configuredPort = options.port ?? config.dev?.port;
  const requestedPort = configuredPort ?? DEFAULT_DEV.port;
  const ffsEnabled = options.ffs ?? config.dev?.ffs ?? DEFAULT_DEV.ffs;

  const server = await startDevServer({
    configDir,
    config,
    host,
    port: requestedPort,
    strictPort: configuredPort !== undefined,
  });
  const port = server.port;
  if (port !== requestedPort) {
    console.log(`Port ${requestedPort} is in use, using ${port} instead.`);
  }

  // Default BASE_URL to our own address so signed fn URLs follow the port
  // wherever it lands; the preview app and user fns read it per request.
  const base = resolveBaseUrl(process.env.BASE_URL, host, port);
  if (base.defaulted) {
    process.env.BASE_URL = base.baseUrl;
    console.log(`BASE_URL not set, defaulting to ${base.baseUrl}`);
  } else if (base.warning) {
    console.warn(`Warning: ${base.warning}`);
  }

  let ffsProc: ChildProcess | null = null;
  if (ffsEnabled) {
    ffsProc = await startFfsSidecar(configDir);
  }

  console.log(
    `\nEffing dev server (${config.project}): http://${host}:${port}\n`,
  );

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

async function startFfsSidecar(
  configDir: string,
): Promise<ChildProcess | null> {
  const ffsBin = path.resolve(configDir, "node_modules/.bin/ffs");
  if (!fs.existsSync(ffsBin)) {
    console.log("FFS sidecar disabled (no @effing/ffs installed)");
    return null;
  }

  // Give each instance's sidecar its own port. FFS reads FFS_PORT (then
  // PORT, then 2000); when neither is set, probe for a free one so two dev
  // servers don't fight over 2000 — or worse, one silently renders through
  // the other's sidecar.
  const env = { ...process.env };
  const configured = process.env.FFS_PORT ?? process.env.PORT;
  const ffsPort = configured
    ? Number(configured)
    : await findFreePort(DEFAULT_FFS_PORT);
  if (!configured) {
    env.FFS_PORT = String(ffsPort);
    if (ffsPort !== DEFAULT_FFS_PORT) {
      console.log(
        `FFS port ${DEFAULT_FFS_PORT} is in use, sidecar will use ${ffsPort} instead.`,
      );
    }
  }
  // Point the preview's FFS flows (and user fns) at this instance's sidecar.
  if (!process.env.FFS_BASE_URL) {
    process.env.FFS_BASE_URL = `http://127.0.0.1:${ffsPort}`;
  }

  return spawn(ffsBin, [], {
    cwd: configDir,
    stdio: "inherit",
    env,
  });
}
