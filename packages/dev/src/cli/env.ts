import crypto from "node:crypto";
import { loadEnv } from "vite";

/**
 * Load `.env`, `.env.local`, `.env.development`, `.env.development.local` from
 * the project root and merge them into `process.env`. Existing `process.env`
 * values take precedence (so explicit `FOO=bar pnpm dev` keeps working).
 */
export function applyDotenv(projectRoot: string): void {
  const env = loadEnv("development", projectRoot, "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Fill in a throwaway `SECRET_KEY` when none is configured, so `effing dev`
 * and `effing render` work with zero env setup. The key only lives for the
 * process, so URLs signed with it die with the server — fine for both, since
 * the preview app re-mints its URLs on every request. `effing url` and the
 * production server still require a real key: their URLs must stay valid
 * beyond a single process.
 */
export function ensureSecretKey(): { secretKey: string; generated: boolean } {
  const configured = process.env.SECRET_KEY;
  if (configured) return { secretKey: configured, generated: false };
  const secretKey = crypto.randomBytes(32).toString("hex");
  process.env.SECRET_KEY = secretKey;
  return { secretKey, generated: true };
}
