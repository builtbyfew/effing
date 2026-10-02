import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Metafile } from "esbuild";
import { unresolvableImports } from "./build";

describe("unresolvableImports", () => {
  let project: string;

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), "effing-build-"));
  });

  afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
  });

  const install = (dir: string, name: string) => {
    const pkg = path.join(dir, "node_modules", name);
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(pkg, "package.json"), "{}");
  };

  const bundleImporting = (...paths: [string, boolean][]): Metafile => ({
    inputs: {},
    outputs: {
      "dist/server.js": {
        bytes: 0,
        inputs: {},
        exports: [],
        imports: paths.map(([p, external]) => ({
          path: p,
          kind: "import-statement" as const,
          external,
        })),
      },
    },
  });

  const outFile = () => path.join(project, "dist", "server.js");

  it("finds nothing missing when every external package is installed", () => {
    install(project, "@effing/canvas");
    install(project, "left-pad");
    const metafile = bundleImporting(
      ["@effing/canvas", true],
      ["left-pad/lib/index.js", true],
      ["node:fs", true],
      ["fs", true],
    );
    expect(unresolvableImports(metafile, outFile())).toEqual([]);
  });

  it("names the packages Node could not find from the bundle", () => {
    install(project, "@effing/canvas");
    const metafile = bundleImporting(
      ["@effing/canvas", true],
      ["@effing/skia", true],
      ["@effing/skia/extensions", true],
      ["@napi-rs/canvas", true],
    );
    expect(unresolvableImports(metafile, outFile())).toEqual([
      "@effing/skia",
      "@napi-rs/canvas",
    ]);
  });

  it("looks in the directories above the bundle, as Node does", () => {
    const workspace = path.join(project, "apps", "video");
    fs.mkdirSync(workspace, { recursive: true });
    install(project, "@effing/canvas");
    expect(
      unresolvableImports(
        bundleImporting(["@effing/canvas", true]),
        path.join(workspace, "dist", "server.js"),
      ),
    ).toEqual([]);
  });

  it("ignores imports that were bundled, and relative or absolute ones", () => {
    const metafile = bundleImporting(
      ["some-inlined-package", false],
      ["./chunk.js", true],
      ["/abs/file.js", true],
    );
    expect(unresolvableImports(metafile, outFile())).toEqual([]);
  });
});
