import { describe, test, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("copy-template", () => {
  test("template package.json has no workspace: or catalog: references", async () => {
    const templatePkg = JSON.parse(
      await fs.readFile(
        path.resolve(__dirname, "../template/package.json"),
        "utf-8",
      ),
    );

    // Check all dependencies for invalid protocols
    for (const depType of ["dependencies", "devDependencies"]) {
      for (const [dep, version] of Object.entries(templatePkg[depType] || {})) {
        expect(version, `${dep} has invalid version`).not.toMatch(
          /^(workspace:|catalog:)/,
        );
      }
    }
  });

  test("template package.json has no private or license field", async () => {
    const templatePkg = JSON.parse(
      await fs.readFile(
        path.resolve(__dirname, "../template/package.json"),
        "utf-8",
      ),
    );

    expect(templatePkg.private).toBeUndefined();
    expect(templatePkg.license).toBeUndefined();
  });

  test("dotfiles are renamed to _DOT_ prefixed", async () => {
    const templateDir = path.resolve(__dirname, "../template");

    // Should have _DOT_env.example, not .env.example
    await expect(
      fs.access(path.join(templateDir, "_DOT_env.example")),
    ).resolves.toBeUndefined();

    // .env.example should not exist
    await expect(
      fs.access(path.join(templateDir, ".env.example")),
    ).rejects.toThrow();
  });
});
