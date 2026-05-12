import { loadEnv } from "vite";
import invariant from "tiny-invariant";
import { signFnSegment } from "@effing/fn/server";
import type { FnKind } from "@effing/fn";
import { loadConfig } from "../config/load";
import { DEFAULT_RESOLUTIONS } from "../config/schema";

const FN_KINDS: readonly FnKind[] = ["image", "annie", "effie"] as const;

export type UrlOptions = {
  config?: string;
  props?: string;
  width?: number;
  height?: number;
};

export async function runUrl(
  kind: string,
  id: string,
  options: UrlOptions = {},
): Promise<void> {
  if (!FN_KINDS.includes(kind as FnKind)) {
    throw new Error(
      `Invalid kind '${kind}'. Expected one of: ${FN_KINDS.join(", ")}.`,
    );
  }
  if (!id) {
    throw new Error("Missing fn id.");
  }

  const cwd = process.cwd();
  const { config, configDir } = await loadConfig(cwd, options.config);

  // Merge .env files into process.env so BASE_URL / SECRET_KEY resolve the
  // same way they do under `effing dev`.
  const env = loadEnv("development", configDir, "");
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  const baseUrl = process.env.BASE_URL;
  const secretKey = process.env.SECRET_KEY;
  invariant(baseUrl, "BASE_URL env var is required");
  invariant(secretKey, "SECRET_KEY env var is required");

  const props = parseProps(options.props);
  const fallback = config.dev?.resolutions?.[0] ?? DEFAULT_RESOLUTIONS[0];
  const width = options.width ?? fallback.width;
  const height = options.height ?? fallback.height;

  const segment = await signFnSegment(
    { id, props, bounds: { width, height } },
    secretKey,
  );
  const url = `${baseUrl.replace(/\/$/, "")}/${kind}/${segment}`;
  console.log(url);
}

function parseProps(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined || raw === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`--props is not valid JSON: ${msg}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--props must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}
