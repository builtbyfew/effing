import { defineConfig } from "vitest/config";

// The package root also ships a `vite.config.ts` that is consumed by
// `effing dev` at runtime. Vitest would auto-load it and fail because it
// expects a React Router app context. This explicit Vitest config takes
// precedence and keeps tests isolated.
export default defineConfig({});
