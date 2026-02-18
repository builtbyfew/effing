import { posix } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin, ResolvedConfig } from "vite";

interface EstreeNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

const TARGET_MODULES = new Set(["@effing/satori/pool", "@effing/satori"]);

const SCOPE_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ClassExpression",
  "BlockStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "SwitchStatement",
  "CatchClause",
]);

function isEstreeNode(value: unknown): value is EstreeNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as EstreeNode).type === "string" &&
    typeof (value as EstreeNode).start === "number" &&
    typeof (value as EstreeNode).end === "number"
  );
}

function walk(
  node: EstreeNode,
  enter: (node: EstreeNode, parent: EstreeNode | null) => void,
  leave?: (node: EstreeNode, parent: EstreeNode | null) => void,
  parent: EstreeNode | null = null,
): void {
  enter(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const val = node[key];
    if (isEstreeNode(val)) {
      walk(val, enter, leave, node);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (isEstreeNode(item)) {
          walk(item, enter, leave, node);
        }
      }
    }
  }
  leave?.(node, parent);
}

function findImportedLocalNames(ast: EstreeNode): Set<string> {
  const names = new Set<string>();
  const body = ast.body as EstreeNode[] | undefined;
  if (!Array.isArray(body)) return names;

  for (const node of body) {
    if (
      node.type !== "ImportDeclaration" ||
      !isEstreeNode(node.source) ||
      !TARGET_MODULES.has(node.source.value as string)
    )
      continue;
    if ((node.importKind as string | undefined) === "type") continue;

    const specifiers = node.specifiers as EstreeNode[] | undefined;
    if (!Array.isArray(specifiers)) continue;

    for (const spec of specifiers) {
      if (spec.type !== "ImportSpecifier") continue;
      if ((spec.importKind as string | undefined) === "type") continue;
      const imported = spec.imported as EstreeNode | undefined;
      const local = spec.local as EstreeNode | undefined;
      if (imported && (imported.name as string) === "createSatoriPool" && local)
        names.add(local.name as string);
    }
  }
  return names;
}

function collectPatternNames(
  pattern: EstreeNode,
  tracked: Set<string>,
  into: Set<string>,
): void {
  switch (pattern.type) {
    case "Identifier":
      if (tracked.has(pattern.name as string)) into.add(pattern.name as string);
      break;
    case "ObjectPattern": {
      const props = pattern.properties as EstreeNode[] | undefined;
      if (Array.isArray(props)) {
        for (const prop of props) {
          if (prop.type === "RestElement") {
            const arg = prop.argument as EstreeNode | undefined;
            if (isEstreeNode(arg)) collectPatternNames(arg, tracked, into);
          } else {
            // Property node — use value if present, fall back to key for
            // robustness across parser node shapes (shorthand properties)
            const target = (prop.value ?? prop.key) as EstreeNode | undefined;
            if (isEstreeNode(target))
              collectPatternNames(target, tracked, into);
          }
        }
      }
      break;
    }
    case "ArrayPattern": {
      const elems = pattern.elements as (EstreeNode | null)[] | undefined;
      if (Array.isArray(elems)) {
        for (const elem of elems) {
          if (isEstreeNode(elem)) collectPatternNames(elem, tracked, into);
        }
      }
      break;
    }
    case "RestElement": {
      const arg = pattern.argument as EstreeNode | undefined;
      if (isEstreeNode(arg)) collectPatternNames(arg, tracked, into);
      break;
    }
    case "AssignmentPattern": {
      const left = pattern.left as EstreeNode | undefined;
      if (isEstreeNode(left)) collectPatternNames(left, tracked, into);
      break;
    }
  }
}

function collectHoistedVarNames(
  body: EstreeNode[],
  tracked: Set<string>,
): Set<string> {
  const found = new Set<string>();

  function scanStatements(stmts: EstreeNode[]): void {
    for (const stmt of stmts) {
      if (
        stmt.type === "VariableDeclaration" &&
        (stmt.kind as string) === "var"
      ) {
        const decls = stmt.declarations as EstreeNode[] | undefined;
        if (!Array.isArray(decls)) continue;
        for (const d of decls) {
          const id = d.id as EstreeNode | undefined;
          if (isEstreeNode(id)) collectPatternNames(id, tracked, found);
        }
      }
      // Recurse into blocks but NOT into nested functions
      if (stmt.type === "BlockStatement" || stmt.type === "SwitchStatement") {
        const inner = (stmt.body ?? stmt.cases) as EstreeNode[] | undefined;
        if (Array.isArray(inner)) scanStatements(inner);
      }
      if (stmt.type === "IfStatement") {
        if (isEstreeNode(stmt.consequent)) scanStatements([stmt.consequent]);
        if (isEstreeNode(stmt.alternate)) scanStatements([stmt.alternate]);
      }
      if (
        stmt.type === "ForStatement" ||
        stmt.type === "ForInStatement" ||
        stmt.type === "ForOfStatement" ||
        stmt.type === "WhileStatement" ||
        stmt.type === "DoWhileStatement"
      ) {
        if (isEstreeNode(stmt.body)) scanStatements([stmt.body]);
        if (isEstreeNode(stmt.init)) scanStatements([stmt.init]);
        if (isEstreeNode(stmt.left)) scanStatements([stmt.left]);
      }
      if (stmt.type === "TryStatement") {
        if (isEstreeNode(stmt.block)) scanStatements([stmt.block]);
        if (isEstreeNode(stmt.handler)) {
          const handlerBody = stmt.handler.body as EstreeNode | undefined;
          if (isEstreeNode(handlerBody)) scanStatements([handlerBody]);
        }
        if (isEstreeNode(stmt.finalizer)) scanStatements([stmt.finalizer]);
      }
      if (stmt.type === "LabeledStatement" && isEstreeNode(stmt.body)) {
        scanStatements([stmt.body]);
      }
      if (stmt.type === "SwitchCase") {
        const consequent = stmt.consequent as EstreeNode[] | undefined;
        if (Array.isArray(consequent)) scanStatements(consequent);
      }
    }
  }

  scanStatements(body);
  return found;
}

function collectBlockScopedNames(
  body: EstreeNode[],
  tracked: Set<string>,
): Set<string> {
  const found = new Set<string>();
  for (const stmt of body) {
    if (
      stmt.type === "FunctionDeclaration" ||
      stmt.type === "ClassDeclaration"
    ) {
      const id = stmt.id as EstreeNode | undefined;
      if (id?.type === "Identifier" && tracked.has(id.name as string))
        found.add(id.name as string);
    }
    if (
      stmt.type === "VariableDeclaration" &&
      ((stmt.kind as string) === "let" || (stmt.kind as string) === "const")
    ) {
      const decls = stmt.declarations as EstreeNode[] | undefined;
      if (Array.isArray(decls)) {
        for (const d of decls) {
          const id = d.id as EstreeNode | undefined;
          if (isEstreeNode(id)) collectPatternNames(id, tracked, found);
        }
      }
    }
  }
  return found;
}

function collectEdits(
  ast: EstreeNode,
  localNames: Set<string>,
  warn: (msg: string) => void,
): TextEdit[] {
  const edits: TextEdit[] = [];
  const scopeStack: { names: Set<string>; isFunction: boolean }[] = [
    { names: new Set(), isFunction: true },
  ];

  function isShadowed(name: string): boolean {
    for (let i = scopeStack.length - 1; i >= 1; i--) {
      if (scopeStack[i].names.has(name)) return true;
    }
    return false;
  }

  function nearestFunctionScope(): { names: Set<string>; isFunction: boolean } {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].isFunction) return scopeStack[i];
    }
    return scopeStack[0];
  }

  function getFunctionBody(node: EstreeNode): EstreeNode[] | null {
    const body = node.body as EstreeNode | EstreeNode[] | undefined;
    if (isEstreeNode(body) && body.type === "BlockStatement") {
      const stmts = body.body as EstreeNode[] | undefined;
      return Array.isArray(stmts) ? stmts : null;
    }
    return null;
  }

  walk(
    ast,
    (node, parent) => {
      // Push scope
      if (SCOPE_TYPES.has(node.type)) {
        const isFunction =
          node.type === "FunctionDeclaration" ||
          node.type === "FunctionExpression" ||
          node.type === "ArrowFunctionExpression";

        const scope = { names: new Set<string>(), isFunction };
        scopeStack.push(scope);

        // Prescan for hoisting
        if (isFunction) {
          const body = getFunctionBody(node);
          if (body) {
            const hoisted = collectHoistedVarNames(body, localNames);
            for (const n of hoisted) scope.names.add(n);
          }
          // Add function params
          const params = node.params as EstreeNode[] | undefined;
          if (Array.isArray(params)) {
            for (const p of params) {
              collectPatternNames(p, localNames, scope.names);
            }
          }
          // Named FunctionExpression id is only visible inside its own body
          if (node.type === "FunctionExpression") {
            const id = node.id as EstreeNode | undefined;
            if (id?.type === "Identifier" && localNames.has(id.name as string))
              scope.names.add(id.name as string);
          }
        }

        // Named ClassExpression id is only visible inside the class body
        if (node.type === "ClassExpression") {
          const id = node.id as EstreeNode | undefined;
          if (id?.type === "Identifier" && localNames.has(id.name as string))
            scope.names.add(id.name as string);
        }

        if (node.type === "BlockStatement") {
          const body = node.body as EstreeNode[] | undefined;
          if (Array.isArray(body)) {
            const scoped = collectBlockScopedNames(body, localNames);
            for (const n of scoped) scope.names.add(n);
          }
        }

        if (node.type === "SwitchStatement") {
          const cases = node.cases as EstreeNode[] | undefined;
          if (Array.isArray(cases)) {
            const stmts: EstreeNode[] = [];
            for (const c of cases) {
              const consequent = c.consequent as EstreeNode[] | undefined;
              if (Array.isArray(consequent)) stmts.push(...consequent);
            }
            const scoped = collectBlockScopedNames(stmts, localNames);
            for (const n of scoped) scope.names.add(n);
          }
        }

        if (node.type === "CatchClause") {
          const param = node.param as EstreeNode | undefined;
          if (isEstreeNode(param))
            collectPatternNames(param, localNames, scope.names);
        }
      }

      // Track variable declarations
      if (node.type === "VariableDeclarator" && parent) {
        const id = node.id as EstreeNode | undefined;
        if (isEstreeNode(id)) {
          const kind = (parent as EstreeNode).kind as string | undefined;
          const target =
            kind === "var"
              ? nearestFunctionScope().names
              : kind === "let" || kind === "const"
                ? scopeStack[scopeStack.length - 1].names
                : null;
          if (target) collectPatternNames(id, localNames, target);
        }
      }

      // Track function declarations (name goes to enclosing scope)
      if (node.type === "FunctionDeclaration") {
        const id = node.id as EstreeNode | undefined;
        if (id?.type === "Identifier" && localNames.has(id.name as string)) {
          const target =
            scopeStack.length >= 2
              ? scopeStack[scopeStack.length - 2]
              : scopeStack[0];
          target.names.add(id.name as string);
        }
      }

      // Track class declarations (block-scoped, name goes to current scope)
      if (node.type === "ClassDeclaration") {
        const id = node.id as EstreeNode | undefined;
        if (id?.type === "Identifier" && localNames.has(id.name as string)) {
          scopeStack[scopeStack.length - 1].names.add(id.name as string);
        }
      }

      // Detect call sites
      if (node.type === "CallExpression") {
        const callee = node.callee as EstreeNode | undefined;
        if (
          callee?.type === "Identifier" &&
          localNames.has(callee.name as string) &&
          !isShadowed(callee.name as string)
        ) {
          if (typeof callee.end !== "number" || typeof node.end !== "number")
            return;

          const args = node.arguments as EstreeNode[] | undefined;
          if (!Array.isArray(args) || args.length === 0) {
            // No args: replace entire arg list
            edits.push({
              start: callee.end,
              end: node.end,
              replacement: '({ workerFile: "__SATORI_WORKER_FILE__" })',
            });
          } else if (args[0].type === "ObjectExpression") {
            if (typeof args[0].start !== "number") return;
            edits.push({
              start: args[0].start + 1,
              end: args[0].start + 1,
              replacement: ' workerFile: "__SATORI_WORKER_FILE__",',
            });
          } else {
            warn(
              `satoriPoolPlugin: unexpected first argument type "${args[0].type}" in createSatoriPool() call`,
            );
          }
        }
      }
    },
    (node) => {
      if (SCOPE_TYPES.has(node.type)) {
        scopeStack.pop();
      }
    },
  );

  return edits;
}

function applyEdits(code: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let result = code;
  for (const { start, end, replacement } of sorted) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }
  return result;
}

/**
 * Vite plugin that bundles the `@effing/satori` worker into the SSR output and
 * rewrites `createSatoriPool()` calls to point at it.
 *
 * **This plugin is required for production SSR builds.** Without it the worker
 * path resolved via `import.meta.url` breaks after Vite bundles the pool code,
 * because the URL points at the build output directory instead of `node_modules`.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { satoriPoolPlugin } from "@effing/satori/vite";
 *
 * export default defineConfig({
 *   plugins: [satoriPoolPlugin()],
 * });
 * ```
 */
export function satoriPoolPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: "@effing/satori:worker",
    apply: "build",

    configResolved(config) {
      resolvedConfig = config;
    },

    transform(code, id, options) {
      if (!options?.ssr || !code.includes("createSatoriPool")) return;

      let ast: EstreeNode;
      try {
        ast = this.parse(code) as unknown as EstreeNode;
      } catch {
        if (!id.startsWith("\0")) {
          this.warn(`satoriPoolPlugin: skipped AST transform for ${id}`);
        }
        return;
      }

      const localNames = findImportedLocalNames(ast);
      if (localNames.size === 0) return;

      const edits = collectEdits(ast, localNames, (msg) =>
        this.warn(`${msg} (${id})`),
      );
      if (edits.length === 0) return;
      return { code: applyEdits(code, edits), map: null };
    },

    renderChunk(code, chunk) {
      const placeholder = '"__SATORI_WORKER_FILE__"';
      if (!code.includes(placeholder)) return;

      const chunkDir = posix.dirname(chunk.fileName);
      const relToRoot = chunkDir === "." ? "." : posix.relative(chunkDir, ".");
      const workerRel = posix.join(relToRoot, "satori-worker.js");
      const expr = `import.meta.dirname + ${JSON.stringify("/" + workerRel)}`;

      return {
        code: code.replaceAll(placeholder, expr),
        map: null,
      };
    },

    async writeBundle(outputOptions) {
      if (!resolvedConfig.build.ssr) return;

      const workerEntry = fileURLToPath(
        new URL("../worker/index.js", import.meta.url),
      );
      const outDir = outputOptions.dir ?? resolvedConfig.build.outDir;

      const { build } = await import("vite");
      await build({
        configFile: false,
        logLevel: "silent",
        build: {
          write: true,
          emptyOutDir: false,
          outDir,
          lib: {
            entry: workerEntry,
            formats: ["es"],
            fileName: () => "satori-worker.js",
          },
          rollupOptions: {
            external: ["@resvg/resvg-js"],
          },
        },
      });
    },
  };
}
