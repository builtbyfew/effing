// Client-safe constants. Pure data; no Node imports. The `urls.server.ts`
// module re-exports RESOLUTIONS too but also pulls in @effing/fn/server
// (which has Node-only deps), so the client imports from here directly.
// @ts-expect-error virtual module provided by @effing/dev's Vite plugin.
import { resolutions } from "virtual:effing/config";

export type Resolution = { width: number; height: number; label: string };

export const RESOLUTIONS = resolutions as Resolution[];
