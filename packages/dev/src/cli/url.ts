import invariant from "tiny-invariant";
import { signFnSegment } from "@effing/fn/server";
import type { FnKind } from "@effing/fn";
import { loadConfig } from "../config/load";
import { DEFAULT_DEV, DEFAULT_RESOLUTIONS } from "../config/schema";
import { applyDotenv } from "./env";
import { parseProps } from "./props";

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
  applyDotenv(configDir);

  // Default BASE_URL to the dev server's configured address, mirroring the
  // default `effing dev` applies when the var is unset.
  const devHost = config.dev?.host ?? DEFAULT_DEV.host;
  const devPort = config.dev?.port ?? DEFAULT_DEV.port;
  const baseUrl = process.env.BASE_URL ?? `http://${devHost}:${devPort}`;
  const secretKey = process.env.SECRET_KEY;
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
