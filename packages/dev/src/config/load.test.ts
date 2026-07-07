import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findConfigFile, loadConfig } from "./load";

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "effing-load-"));
});

afterEach(async () => {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
});

async function writeConfig(filename: string, contents: string): Promise<void> {
  await fs.promises.writeFile(path.join(tempDir, filename), contents);
}

describe("findConfigFile", () => {
  it("throws when no config file exists in the directory", () => {
    expect(() => findConfigFile(tempDir)).toThrow(
      `No effing.config.ts found in ${tempDir}`,
    );
  });

  it("prefers effing.config.ts over later candidates", async () => {
    await writeConfig("effing.config.ts", "export default {};");
    await writeConfig("effing.config.js", "export default {};");
    expect(findConfigFile(tempDir)).toBe(
      path.join(tempDir, "effing.config.ts"),
    );
  });

  it("resolves an explicit relative path against cwd", async () => {
    await writeConfig("custom.config.ts", "export default {};");
    expect(findConfigFile(tempDir, "custom.config.ts")).toBe(
      path.join(tempDir, "custom.config.ts"),
    );
  });

  it("throws when an explicit path does not exist", () => {
    const missing = path.join(tempDir, "missing.config.ts");
    expect(() => findConfigFile(tempDir, missing)).toThrow(
      `Config file not found: ${missing}`,
    );
  });
});

describe("loadConfig", () => {
  it("loads a valid config that uses defineConfig from @effing/dev", async () => {
    await writeConfig(
      "effing.config.ts",
      `import { defineConfig } from "@effing/dev";
export default defineConfig({ project: "my-project" });`,
    );

    const result = await loadConfig(tempDir);

    expect(result.config).toEqual({ project: "my-project" });
    expect(result.configPath).toBe(path.join(tempDir, "effing.config.ts"));
    expect(result.configDir).toBe(tempDir);
  });

  it("preserves optional fields such as dev options", async () => {
    await writeConfig(
      "effing.config.mjs",
      `export default {
  project: "demo",
  annies: ["annies/*.ts"],
  dev: { port: 4000, ffs: false },
};`,
    );

    const { config } = await loadConfig(tempDir);

    expect(config.project).toBe("demo");
    expect(config.annies).toEqual(["annies/*.ts"]);
    expect(config.dev).toEqual({ port: 4000, ffs: false });
  });

  it("removes the bundled temp file after a successful load", async () => {
    await writeConfig(
      "effing.config.ts",
      `export default { project: "cleanup" };`,
    );

    await loadConfig(tempDir);

    const leftovers = (await fs.promises.readdir(tempDir)).filter((name) =>
      /^\.effing\.config\..*\.mjs$/.test(name),
    );
    expect(leftovers).toEqual([]);
  });

  it("removes the bundled temp file even when validation fails", async () => {
    await writeConfig("effing.config.ts", `export default { project: 42 };`);

    await expect(loadConfig(tempDir)).rejects.toThrow();

    const leftovers = (await fs.promises.readdir(tempDir)).filter((name) =>
      /^\.effing\.config\..*\.mjs$/.test(name),
    );
    expect(leftovers).toEqual([]);
  });

  it("throws when the config has no default export", async () => {
    await writeConfig(
      "effing.config.ts",
      `export const config = { project: "nope" };`,
    );

    await expect(loadConfig(tempDir)).rejects.toThrow(/has no default export/);
  });

  it("throws when the default export fails schema validation", async () => {
    await writeConfig("effing.config.ts", `export default { images: [] };`);

    await expect(loadConfig(tempDir)).rejects.toThrow(
      `Invalid config in ${path.join(tempDir, "effing.config.ts")}`,
    );
  });
});
