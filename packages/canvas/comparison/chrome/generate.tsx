/**
 * Lays every Chrome fixture out in headless Chrome, and writes what Chrome
 * makes of it to `references/`: `pnpm --filter @effing/canvas
 * comparison:chrome [module…]`. See `../README.md`.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import * as prettier from "prettier";
import { loadFonts, loadScriptFonts } from "../_helpers/fonts.ts";
import { REFERENCES, hashOf, markupOf, slugOf } from "./fixture.ts";
import type {
  Box,
  ChromeFixture,
  ChromeReference,
  ChromeReferenceFile,
} from "./fixture.ts";
import { modules } from "./fixtures/index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Chrome, from `CHROME_PATH` or where it's usually installed. */
function findChrome(): string {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          join(
            homedir(),
            "Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          ),
        ]
      : process.platform === "win32"
        ? [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/opt/google/chrome/chrome",
          ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `Chrome isn't in any of ${candidates.join(", ")}: set CHROME_PATH to it`,
    );
  }
  return found;
}

/**
 * The page fixtures are laid out on: the fonts canvas renders them with, as
 * web fonts, and a frame of the canvas's size with canvas's defaults (see
 * `DEFAULT_STYLE` and `applyStylesToYoga`). The rest of canvas's defaults are
 * set on each fixture (`prepare` in `measure.browser.js`).
 */
async function pageHtml(): Promise<string> {
  const base64 = (data: Buffer | ArrayBuffer) =>
    (Buffer.isBuffer(data) ? data : Buffer.from(data)).toString("base64");
  const fonts = [...(await loadFonts()), ...(await loadScriptFonts())];
  const faces = fonts.map(
    (font) => `@font-face {
  font-family: "${font.name}";
  font-weight: ${font.weight};
  font-style: ${font.style};
  src: url(data:font/woff;base64,${base64(font.data)}) format("woff");
}`,
  );
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${faces.join("\n")}
html, body { margin: 0; background: transparent; }
/* The canvas, in which canvas lays the element out: a row. */
#__frame {
  display: flex;
  flex-direction: row;
  position: relative;
  overflow: hidden;
  font-family: Helvetica, Arial, sans-serif;
  font-size: 16px;
  font-weight: 400;
  font-style: normal;
  line-height: normal;
  color: black;
}
/* Every element is a flex container in border-box sizing, positioned for
   what it holds, with no styles of the browser's own. */
#__frame *:not(br, svg, svg *) {
  display: flex;
  position: relative;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid;
  font: inherit;
  color: inherit;
  text-decoration: inherit;
  list-style: none;
}
</style>
<script>${readFileSync(join(HERE, "measure.browser.js"), "utf8")}</script>
</head>
<body><div id="__frame"></div></body>
</html>`;
}

type Measured = Record<string, Box>;

/** Lay `fixture` out on the page, and measure it. */
async function layOut(page: Page, fixture: ChromeFixture): Promise<Measured> {
  await page.setViewportSize({
    width: Math.max(1, Math.ceil(fixture.width)),
    height: Math.max(1, Math.ceil(fixture.height)),
  });
  return page.evaluate(
    async ({ html, width, height }) => {
      const reference = (
        window as unknown as {
          __chromeReference: {
            prepare(frame: HTMLElement): void;
            measure(frame: HTMLElement): Measured;
          };
        }
      ).__chromeReference;
      const frame = document.getElementById("__frame")!;
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      frame.innerHTML = html;
      reference.prepare(frame);
      await document.fonts.ready;
      // Images are laid out at their size once they've loaded.
      await Promise.all(
        [...frame.querySelectorAll("img")].map((img) =>
          img.decode().catch(() => undefined),
        ),
      );
      return reference.measure(frame);
    },
    {
      // A CR in markup is parsed as a newline, where canvas has text with a
      // lone CR in it; a character reference to one isn't.
      html: markupOf(fixture).replace(/\r/g, "&#13;"),
      width: fixture.width,
      height: fixture.height,
    },
  );
}

async function format(path: string, content: string): Promise<string> {
  const options = (await prettier.resolveConfig(path)) ?? {};
  return prettier.format(content, { ...options, filepath: path });
}

async function main() {
  const only = process.argv.slice(2);
  const unknown = only.filter((name) => !modules.some((m) => m.name === name));
  if (unknown.length > 0) {
    throw new Error(
      `No fixture module ${unknown.join(", ")}: there's ${modules.map((m) => m.name).join(", ")}`,
    );
  }
  const selected = only.length
    ? modules.filter((m) => only.includes(m.name))
    : modules;

  const browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
  });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    // What the page logs, for debugging `measure.browser.js`.
    page.on("console", (message) => console.log(`[chrome] ${message.text()}`));
    await page.setContent(await pageHtml());
    // Load every face up front, so that no fixture waits on one.
    await page.evaluate(() =>
      Promise.all([...document.fonts].map((face) => face.load())),
    );
    const chrome = browser.version();
    const platform = `${process.platform}-${process.arch}`;
    console.log(`Chrome ${chrome} on ${platform}`);

    mkdirSync(REFERENCES, { recursive: true });
    for (const module of selected) {
      const fixtures: Record<string, ChromeReference> = {};
      const shots = join(REFERENCES, module.name);
      rmSync(shots, { recursive: true, force: true });
      for (const fixture of module.fixtures) {
        const reference: ChromeReference = {
          hash: hashOf(fixture),
          elements: await layOut(page, fixture),
        };
        if (fixture.screenshot) {
          mkdirSync(shots, { recursive: true });
          // Let the page paint at its new size first: a screenshot taken
          // straight after the viewport changed can be of a stale frame.
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const file = `${module.name}/${slugOf(fixture)}.png`;
          await page.screenshot({
            path: join(REFERENCES, file),
            clip: { x: 0, y: 0, width: fixture.width, height: fixture.height },
            omitBackground: true,
          });
          reference.screenshot = file;
        }
        fixtures[fixture.name] = reference;
      }
      const file: ChromeReferenceFile = { chrome, platform, fixtures };
      const path = join(REFERENCES, `${module.name}.json`);
      await writeFile(path, await format(path, JSON.stringify(file)));
      console.log(
        `${module.name}: ${module.fixtures.length} fixtures → ${path}`,
      );
    }
  } finally {
    await browser.close();
  }
}

await main();
