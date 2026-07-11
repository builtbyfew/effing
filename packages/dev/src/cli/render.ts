import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { signFnSegment } from "@effing/fn/server";
import type { FnKind } from "@effing/fn";
import { loadConfig } from "../config/load";
import { DEFAULT_DEV, DEFAULT_RESOLUTIONS } from "../config/schema";
import { startDevServer } from "../server/dev/host";
import { applyDotenv } from "./env";
import { parseProps } from "./props";

const FN_KINDS: readonly FnKind[] = ["image", "annie", "effie"] as const;

export type RenderOptions = {
  config?: string;
  output?: string;
  props?: string;
  width?: number;
  height?: number;
  scale?: number;
};

type Bounds = { width: number; height: number };

/**
 * Pick an output filename for a render when `-o` wasn't given. Image fns
 * choose their own encoding at runtime, so the extension follows the
 * response's Content-Type rather than the kind alone.
 */
export function defaultOutputPath(
  kind: FnKind,
  id: string,
  contentType?: string | null,
): string {
  if (kind === "effie") return `${id}.mp4`;
  if (kind === "annie") return `${id}.tar`;
  const type = (contentType ?? "").split(";", 1)[0].trim().toLowerCase();
  const ext =
    { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[
      type
    ] ?? ".png";
  return `${id}${ext}`;
}

/**
 * The URL the artifact is rendered from. Without explicit props we use the
 * unsigned preview endpoints (pinned to the fn's `previewProps`); with
 * `--props` we mint a signed segment, exactly like `effing url` would.
 */
export async function targetUrl(
  baseUrl: string,
  kind: FnKind,
  id: string,
  props: Record<string, unknown> | undefined,
  bounds: Bounds,
  secretKey: string,
): Promise<string> {
  if (props === undefined) {
    const ext =
      kind === "image" ? ".bytes" : kind === "annie" ? ".tar" : ".json";
    return `${baseUrl}/preview/${kind}/${id}${ext}?w=${bounds.width}&h=${bounds.height}`;
  }
  const segment = await signFnSegment({ id, props, bounds }, secretKey);
  return `${baseUrl}/${kind}/${segment}`;
}

export async function runRender(
  kind: string,
  id: string,
  options: RenderOptions = {},
): Promise<void> {
  if (!FN_KINDS.includes(kind as FnKind)) {
    throw new Error(
      `Invalid kind '${kind}'. Expected one of: ${FN_KINDS.join(", ")}.`,
    );
  }
  if (!id) {
    throw new Error("Missing fn id.");
  }
  if (options.scale !== undefined && kind !== "effie") {
    throw new Error("--scale only applies to effie renders.");
  }
  if (
    options.scale !== undefined &&
    (!Number.isFinite(options.scale) || options.scale <= 0)
  ) {
    throw new Error(`--scale must be a positive number.`);
  }
  const props =
    options.props === undefined ? undefined : parseProps(options.props);

  const cwd = process.cwd();
  const { config, configDir } = await loadConfig(cwd, options.config);
  applyDotenv(configDir);

  // The signed URLs minted here never outlive the ephemeral loopback server,
  // so unlike `effing url` a missing SECRET_KEY isn't fatal — a throwaway
  // key keeps zero-setup renders working.
  if (!process.env.SECRET_KEY) {
    process.env.SECRET_KEY = crypto.randomBytes(32).toString("hex");
  }

  const fallback = config.dev?.resolutions?.[0] ?? DEFAULT_RESOLUTIONS[0];
  const bounds: Bounds = {
    width: options.width ?? fallback.width,
    height: options.height ?? fallback.height,
  };

  // Never strict: we don't care which port we get, and walking up keeps us
  // clear of a dev server already running on the configured port.
  const host = DEFAULT_DEV.host;
  const server = await startDevServer({
    configDir,
    config,
    host,
    port: config.dev?.port ?? DEFAULT_DEV.port,
    strictPort: false,
  });

  try {
    // Sources inside the composition must resolve against the ephemeral
    // server, so BASE_URL points there regardless of what .env says.
    const baseUrl = `http://${host}:${server.port}`;
    process.env.BASE_URL = baseUrl;

    const url = await targetUrl(
      baseUrl,
      kind as FnKind,
      id,
      props,
      bounds,
      process.env.SECRET_KEY,
    );

    process.stderr.write(
      `rendering ${kind} '${id}' via ephemeral dev server at ${baseUrl}\n`,
    );

    let output: string;
    if (kind === "effie") {
      output = options.output ?? defaultOutputPath("effie", id);
      await renderEffie(configDir, url, output, options.scale ?? 1);
    } else {
      output = await download(url, kind as FnKind, id, options.output);
    }
    process.stderr.write(`wrote ${output}\n`);
  } finally {
    await server.close();
    // Same belt-and-suspenders as `effing dev`'s shutdown: everything is
    // closed by now, so a lingering handle (keep-alive socket, watcher
    // straggler) should time-box the process instead of hanging the CLI.
    setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref();
  }
}

async function download(
  url: string,
  kind: FnKind,
  id: string,
  output: string | undefined,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(
      `Render failed: ${response.status} ${response.statusText}${await errorDetail(response)}`,
    );
  }
  const outPath =
    output ?? defaultOutputPath(kind, id, response.headers.get("content-type"));
  await pipeline(
    Readable.fromWeb(response.body as WebReadableStream),
    fs.createWriteStream(outPath),
  );
  return outPath;
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (!text) return "";
    return `\n${text.slice(0, 500)}`;
  } catch {
    return "";
  }
}

/**
 * Render an effie by delegating to the project-local `ffs render` bin — the
 * same discovery the FFS sidecar in `effing dev` uses. Keeps @effing/dev free
 * of a hard dependency on @effing/ffs (and its ffmpeg baggage).
 */
async function renderEffie(
  configDir: string,
  url: string,
  output: string,
  scale: number,
): Promise<void> {
  const ffsBin = path.resolve(configDir, "node_modules/.bin/ffs");
  if (!fs.existsSync(ffsBin)) {
    throw new Error(
      "Rendering an effie requires the @effing/ffs package — install it in " +
        "this project first (e.g. `pnpm add -D @effing/ffs`).",
    );
  }

  const env = { ...process.env };
  // Every source in the composition points at the ephemeral loopback server;
  // don't let FFS's SSRF protection (on when NODE_ENV=production) block them.
  env.FFS_ALLOW_PRIVATE_NETWORKS ??= "true";

  const args = ["render", url, output];
  if (scale !== 1) args.push("--scale", String(scale));

  const child = spawn(ffsBin, args, { cwd: configDir, stdio: "inherit", env });
  const code = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (c) => resolve(c ?? 1));
  });
  if (code !== 0) {
    throw new Error(`ffs render exited with code ${code}`);
  }
}
