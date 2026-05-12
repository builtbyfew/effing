// Server-only. The host process installs `globalThis.__effingDevResolutions`
// from the user's `effing.config.ts`. Routes read via this helper and pass
// the array through their loader data so the client renders the same list.

import { DEFAULT_RESOLUTIONS, type Resolution } from "../../../config/schema";

export type { Resolution } from "../../../config/schema";

export function getResolutions(): Resolution[] {
  return globalThis.__effingDevResolutions ?? DEFAULT_RESOLUTIONS;
}
