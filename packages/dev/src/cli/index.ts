import { Command } from "commander";
import { createRequire } from "node:module";
import { runDev } from "./dev";
import { runBuild } from "./build";
import { runUrl } from "./url";
import { runRender, type RenderOptions } from "./render";
import { runManual } from "./manual";

const require_ = createRequire(import.meta.url);
const { version } = require_("../../package.json") as { version: string };

function wrap(
  fn: (...args: never[]) => Promise<unknown> | unknown,
): (...args: never[]) => Promise<void> {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      process.exitCode = 1;
    }
  };
}

const program = new Command();
program
  .name("effing")
  .description("Dev tooling for Effing projects")
  .version(version);

program
  .command("dev")
  .description("Start the Effing dev server")
  .option("-c, --config <path>", "path to the effing.config.ts file")
  .option("-p, --port <number>", "port to listen on", (v) => parseInt(v, 10))
  .option("-h, --host <host>", "host to bind to")
  .option("--no-ffs", "do not auto-start the FFS sidecar")
  .action(
    wrap(
      async (options: {
        config?: string;
        port?: number;
        host?: string;
        ffs?: boolean;
      }) => {
        await runDev(options);
      },
    ) as never,
  );

program
  .command("build")
  .description("Bundle a production server to dist/server.js")
  .option("-c, --config <path>", "path to the effing.config.ts file")
  .option("-o, --out <path>", "output path", "dist/server.js")
  .action(
    wrap(async (options: { config?: string; out: string }) => {
      await runBuild({ config: options.config, outFile: options.out });
    }) as never,
  );

program
  .command("url <kind> <id>")
  .description(
    "Print a signed fn URL for the given props (kind: image|annie|effie)",
  )
  .option("-c, --config <path>", "path to the effing.config.ts file")
  .option(
    "-p, --props <json>",
    "props as a JSON object (default: {})",
    (v) => v,
  )
  .option("-w, --width <number>", "width in pixels", (v) => parseInt(v, 10))
  .option("--height <number>", "height in pixels", (v) => parseInt(v, 10))
  .action(
    wrap(
      async (
        kind: string,
        id: string,
        options: {
          config?: string;
          props?: string;
          width?: number;
          height?: number;
        },
      ) => {
        await runUrl(kind, id, options);
      },
    ) as never,
  );

program
  .command("render <kind> <id>")
  .description(
    "Render a fn to a file without a running dev server (kind: image|annie|effie)",
  )
  .option("-c, --config <path>", "path to the effing.config.ts file")
  .option(
    "-o, --output <path>",
    "output file (default: <id> plus a kind-based extension)",
  )
  .option(
    "-p, --props <json>",
    "props as a JSON object (default: the fn's previewProps)",
    (v) => v,
  )
  .option("-w, --width <number>", "width in pixels", (v) => parseInt(v, 10))
  .option("--height <number>", "height in pixels", (v) => parseInt(v, 10))
  .option(
    "--scale <number>",
    "output scale factor, effie only (default: 1)",
    (v) => parseFloat(v),
  )
  .action(
    wrap(async (kind: string, id: string, options: RenderOptions) => {
      await runRender(kind, id, options);
    }) as never,
  );

program
  .command("manual")
  .description(
    "Print the Effing manual — tool-level reference for the CLI and fn module shape",
  )
  .option("-c, --config <path>", "path to the effing.config.ts file")
  .action(
    wrap(async (options: { config?: string }) => {
      await runManual(options);
    }) as never,
  );

program.parse();
