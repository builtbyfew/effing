import path from "node:path";
import { createSatoriPool } from "@effing/satori/pool";

export const satoriPool = createSatoriPool(
  process.env.NODE_ENV === "production"
    ? { workerFile: path.resolve("build/satori.mjs") }
    : undefined,
);
