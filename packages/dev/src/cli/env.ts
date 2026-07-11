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
