#!/usr/bin/env node

const useColor = process.stderr.isTTY && process.env.NO_COLOR === undefined;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c("1", s);
const yellow = (s) => c("33", s);
const cyan = (s) => c("36", s);
const dim = (s) => c("2", s);

const args = process.argv.slice(2).join(" ");
const suffix = args ? ` ${args}` : "";

process.stderr.write(
  `
${yellow("⚠")}  ${bold("You probably meant to run a different command.")}

This package (${bold("create-effing")}) is a placeholder published by the
Effing maintainers so the unscoped name cannot be hijacked. The real
scaffolder lives under the ${bold("@effing")} scope.

Use one of these instead:

  ${cyan(`npm create @effing${suffix}`)}
  ${cyan(`pnpm create @effing${suffix}`)}
  ${cyan(`yarn create @effing${suffix}`)}

${dim("Docs: https://github.com/builtbyfew/effing/tree/main/packages/create")}

`,
);

process.exit(1);
