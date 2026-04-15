import { FetchError } from "../handlers/errors";
import { SsrfError } from "../url";

const [, , cmd, ...rest] = process.argv;

if (cmd === "render") {
  const { parseArgs, runRender, USAGE } = await import("./render");
  const result = parseArgs(rest);
  if (result.kind === "help") {
    console.log(USAGE);
    process.exit(0);
  }
  if (result.kind === "error") {
    console.error(result.message);
    process.exit(2);
  }
  try {
    await runRender(result.args);
  } catch (error) {
    if (error instanceof FetchError) {
      console.error(`Fetch failed: ${error.message}`);
      process.exit(3);
    }
    if (error instanceof SsrfError) {
      console.error(`Blocked by SSRF protection: ${error.message}`);
      process.exit(3);
    }
    console.error((error as Error).message ?? String(error));
    process.exit(1);
  }
} else if (cmd === undefined || cmd === "serve") {
  const { startServer } = await import("./serve");
  await startServer();
} else {
  console.error(`Unknown command: ${cmd}

Usage:
  ffs [serve]                                   Start the FFS HTTP server
  ffs render <url-or-json-file> <output.mp4>    Render an Effie composition to a video

Run \`ffs render --help\` for render options.`);
  process.exit(2);
}
