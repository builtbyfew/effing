import { describe, expect, test } from "vitest";
import { EvaluatedModules } from "vite/module-runner";
import { invalidateFile } from "./invalidate";

/** Modules by name, each importing the modules listed for it. */
function graph(imports: Record<string, string[]>) {
  const modules = new EvaluatedModules();
  const node = (name: string) =>
    modules.ensureModule(`/app/${name}.ts`, `/app/${name}.ts`);
  for (const [name, deps] of Object.entries(imports)) {
    const importer = node(name);
    importer.evaluated = true;
    importer.exports = { name };
    for (const dep of deps) {
      node(dep).importers.add(importer.id);
      importer.imports.add(node(dep).id);
    }
  }
  const evaluated = () =>
    Object.keys(imports)
      .filter((name) => node(name).evaluated)
      .sort();
  return { modules, evaluated };
}

describe("invalidateFile", () => {
  test("invalidates the file's module and everything that imports it", () => {
    const { modules, evaluated } = graph({
      shared: [],
      annie: ["shared"],
      effie: ["annie"],
      other: [],
    });
    invalidateFile(modules, "/app/shared.ts");
    expect(evaluated()).toEqual(["other"]);
  });

  test("leaves importers of other files alone", () => {
    const { modules, evaluated } = graph({
      shared: [],
      fonts: [],
      annie: ["shared", "fonts"],
      image: ["fonts"],
    });
    invalidateFile(modules, "/app/shared.ts");
    expect(evaluated()).toEqual(["fonts", "image"]);
  });

  test("survives import cycles and unknown files", () => {
    const { modules, evaluated } = graph({ a: ["b"], b: ["a"], c: [] });
    invalidateFile(modules, "/app/a.ts");
    expect(evaluated()).toEqual(["c"]);
    invalidateFile(modules, "/app/missing.ts");
    expect(evaluated()).toEqual(["c"]);
  });
});
