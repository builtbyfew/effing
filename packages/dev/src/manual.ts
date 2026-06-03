import fs from "node:fs";
import path from "node:path";
import type { EffingConfig } from "./config/schema";
import { DEFAULT_DEV, DEFAULT_RESOLUTIONS } from "./config/schema";
import { FN_KINDS, type FnKind } from "./fns";

export type PackageManager = {
  /** `null` means "no recognized lockfile" — falls back to the direct bin path. */
  name: "npm" | "pnpm" | "yarn" | null;
  /**
   * Render an `effing <subcommand>` invocation using this PM's most idiomatic
   * form that runs the locally-installed binary AND never falls back to
   * fetching `effing` from the registry. (The npm `effing` package is not
   * ours, so a stray fetch could run unrelated code.)
   *
   * - pnpm: `pnpm exec` is local-only by design (`pnpm dlx` is the fetch form).
   * - yarn: `yarn <bin>` consults only the local install (`yarn dlx` is the
   *   fetch form, berry-only).
   * - npm:  `npx --no` (alias for `--yes=false`) errors out instead of
   *   prompting/auto-installing on a miss.
   * - other (bun, deno, no lockfile, …): bun's `bunx` auto-fetches with no
   *   opt-out, and we don't want to guess for unknown PMs — invoke the bin
   *   directly via `./node_modules/.bin/effing`.
   */
  effing: (subcommand: string) => string;
};

const PMS = {
  pnpm: {
    name: "pnpm" as const,
    effing: (s: string) => `pnpm exec effing ${s}`,
  },
  yarn: {
    name: "yarn" as const,
    effing: (s: string) => `yarn effing ${s}`,
  },
  npm: {
    name: "npm" as const,
    effing: (s: string) => `npx --no effing ${s}`,
  },
  unknown: {
    name: null,
    effing: (s: string) => `./node_modules/.bin/effing ${s}`,
  },
} satisfies Record<string, PackageManager>;

const LOCKFILES: Array<{ file: string; pm: PackageManager }> = [
  { file: "pnpm-lock.yaml", pm: PMS.pnpm },
  { file: "yarn.lock", pm: PMS.yarn },
  { file: "package-lock.json", pm: PMS.npm },
];

/**
 * Walk upward from `start` looking for a known lockfile. Falls back to the
 * direct-bin-path form for anything unrecognized (bun, deno, no lockfile).
 */
export function detectPackageManager(start: string): PackageManager {
  let dir = path.resolve(start);
  while (true) {
    for (const { file, pm } of LOCKFILES) {
      if (fs.existsSync(path.join(dir, file))) return pm;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return PMS.unknown;
}

/**
 * Extract the directory portion of a glob — everything before the first glob
 * char. `app/images/*.fn.tsx` → `app/images`. If the glob is an array, the
 * first entry wins.
 */
export function dirOfGlob(glob: string | string[] | undefined): string | null {
  if (glob === undefined) return null;
  const first = Array.isArray(glob) ? glob[0] : glob;
  if (!first) return null;
  const idx = first.search(/[*?[(){}]/);
  const prefix = idx === -1 ? path.dirname(first) : first.slice(0, idx);
  const trimmed = prefix.replace(/\/+$/, "");
  return trimmed || ".";
}

export type ManualContext = {
  pm: PackageManager;
  dirs: Record<FnKind, string | null>;
  defaultWidth: number;
  defaultHeight: number;
  port: number;
  host: string;
  configuredKinds: FnKind[];
  /** Filename of the project's guide (if one exists alongside effing.config.ts), else null. */
  guideFile: string | null;
};

const GUIDE_FILENAMES = ["GUIDE.md", "guide.md"];

function findGuideFile(configDir: string): string | null {
  for (const name of GUIDE_FILENAMES) {
    if (fs.existsSync(path.join(configDir, name))) return name;
  }
  return null;
}

export function buildManualContext(
  config: EffingConfig,
  pm: PackageManager,
  configDir: string,
): ManualContext {
  const dirs: Record<FnKind, string | null> = {
    image: dirOfGlob(config.images),
    annie: dirOfGlob(config.annies),
    effie: dirOfGlob(config.effies),
  };
  const configuredKinds = FN_KINDS.filter((k) => dirs[k] !== null);
  const defaultRes = config.dev?.resolutions?.[0] ?? DEFAULT_RESOLUTIONS[0]!;
  return {
    pm,
    dirs,
    defaultWidth: defaultRes.width,
    defaultHeight: defaultRes.height,
    port: config.dev?.port ?? DEFAULT_DEV.port,
    host: config.dev?.host ?? DEFAULT_DEV.host,
    configuredKinds,
    guideFile: findGuideFile(configDir),
  };
}

const KIND_PLURAL: Record<FnKind, string> = {
  image: "Images",
  annie: "Annies",
  effie: "Effies",
};

export function renderManual(ctx: ManualContext): string {
  const {
    pm,
    dirs,
    defaultWidth,
    defaultHeight,
    port,
    host,
    configuredKinds,
    guideFile,
  } = ctx;

  const sections: string[] = [];

  const intro = guideFile
    ? `Tool-level reference for the \`effing\` CLI and the fn module shape. Your project also has a \`${guideFile}\`, you likely want to read that too for project-specific conventions.`
    : `Tool-level reference for the \`effing\` CLI and the fn module shape. Anything project-specific (font helpers, deploy scripts, import aliases) lives in the project itself, not here.`;

  sections.push(`# Effing manual

${intro}

${
  pm.name
    ? `Commands below are tailored to your package manager (\`${pm.name}\`, detected from your lockfile) and chosen to run the locally-installed \`effing\` binary without falling back to fetching from the npm registry. Your project may alias them as shorter \`package.json\` scripts (e.g. \`${pm.name} run dev\`) — check there for the local form.`
    : `Commands below invoke the locally-installed \`effing\` binary directly via \`./node_modules/.bin/effing\` — no \`npx\`/\`bunx\` style fetch fallback. Your project may alias them as shorter \`package.json\` scripts — check there for the local form.`
}`);

  sections.push(`## What you can build

- **Effing Images** — single-frame stills (slideshow covers, thumbnails, social cards).
- **Effing Annies** — frame-based animations streamed as TAR archives of PNG/JPEG frames (typewriter text, zooms, animated overlays).
- **Effing Effies** — video compositions assembling images, annies, audio, and effects into an MP4.

The typical effie composes several images and annies as separate layers rather than baking everything into one big annie. Small single-purpose annies combine flexibly, cache independently, render in parallel, and are cheap to re-render while iterating. If an annie animates conceptually independent things — or one element holds still while another moves — split it up.`);

  sections.push(`## Project layout

\`\`\`
.
${renderTreeLines(dirs)}└── effing.config.ts         # globs, dev settings
\`\`\`

Drop a file matching one of the configured globs and it's registered automatically. Ids come from the filename without the \`.fn.tsx\` suffix (\`my-animation.fn.tsx\` → id \`my-animation\`).`);

  sections.push(`## The fn module shape

Every fn exports three things:

- \`propsSchema\` — Zod schema describing the runner's input.
- \`previewProps\` — concrete object matching the schema, used by the preview page.
- \`runner\` — the function that produces the output. Its return type differentiates the three kinds.`);

  if (configuredKinds.includes("image") && dirs.image) {
    sections.push(renderImageSection(dirs.image));
  }
  if (configuredKinds.includes("annie") && dirs.annie) {
    sections.push(renderAnnieSection(dirs.annie));
  }
  if (configuredKinds.includes("effie") && dirs.effie) {
    sections.push(renderEffieSection(dirs.effie, dirs.annie));
  }

  sections.push(`## Fonts

\`renderReactElement\` doesn't ship fonts — pass them via \`options.fonts: FontData[]\` whenever you render text. The shape:

\`\`\`ts
import type { FontData } from "@effing/canvas";

const fonts: FontData[] = [
  {
    name: "Inter",
    data: await fetch("https://fonts.gstatic.com/s/inter/.../Inter-Bold.ttf")
      .then((r) => r.arrayBuffer()),
    weight: 700,
    style: "normal",
  },
];
\`\`\`

Match \`name\`/\`weight\`/\`style\` against your CSS — loading weight 700 but leaving \`fontWeight\` off your CSS leaves the default weight 400 unmatched, and text falls back to a system font. Fetch fonts at runtime; never bundle them — that limits where your fns can run.

Most projects wrap font loading in a small helper module to keep \`FontData\` boilerplate out of every fn${guideFile ? ` — \`${guideFile}\` may describe yours` : ""}.`);

  sections.push(`## Preview pages

The dev server (\`${pm.effing("dev")}\`) lists every fn at \`http://${host}:${port}\` and serves an HTML preview for each:

\`\`\`
/preview/image/:imageId
/preview/annie/:annieId
/preview/effie/:effieId
\`\`\`

Each page renders the fn with its \`previewProps\` and lets you tweak bounds via \`?w=\` and \`?h=\` (defaulting to the first entry in \`dev.resolutions\` — currently ${defaultWidth}×${defaultHeight}).`);

  sections.push(`## Inspecting from an agent

HTML previews are for humans clicking through. Each kind also has a machine-readable endpoint that delivers the artifact directly — no HTML scraping, no URL signing required:

\`\`\`
/preview/image/:imageId.bytes
/preview/annie/:annieId.tar
/preview/effie/:effieId.json
\`\`\`

The image and annie endpoints stream encoded bytes (a JPEG/PNG still, or a TAR of frames). The effie endpoint returns JSON — an effie *is* JSON, a description of how to compose other fns, not rendered pixels. These endpoints are pinned to each fn's \`previewProps\`; to inspect custom props you mint a signed URL (see below).

When something looks wrong in a composition, it's usually quickest to work down from that description before reaching for a full render:

- **Start with the effie JSON.** Most composition issues — a missing or misordered layer, a wrong duration or delay, a malformed source URL, bounds that don't match — are visible directly in \`effieData\` without rendering anything. The JSON is also your index into the layers and the sources they point at.
- **Then drill into a single layer.** Follow a layer's \`source\` from the JSON and fetch it — an annie source returns its TAR of frames, an image source returns its bytes. A \`source\` is usually a URL you can request directly: a signed fn URL (the extensionless \`/annie/:segment\` / \`/image/:segment\` form, not the props-pinned \`.tar\`/\`.bytes\` preview endpoints above), but equally any other URL — a CDN that hosts the TAR or still outright, say. If a \`source\` is instead a \`#ref\` like \`#logo\`, resolve it against the effie's top-level \`sources\` map first. Pulling one annie's frames is far cheaper than rendering the whole composition, and isolates most "this element is off" problems to the layer that owns them.
- **Render the full MP4 when the question needs it.** Things that only emerge once everything plays together — cross-segment timing, transitions, motion and effects interacting, audio sync — genuinely need a render. It's the heaviest path (FFS renders the MP4, then you pull frames back out with ffmpeg), so it's worth confirming the layers look right first; for those whole-timeline questions it's the right tool.`);

  sections.push(`## Signed URLs

The \`/image/:segment\`, \`/annie/:segment\`, and \`/effie/:segment\` endpoints encode both props and bounds inside the segment, signed with the project's \`SECRET_KEY\`. Nobody without the key can mint URLs with arbitrary inputs, and the URL fully determines the output — so the same signed URL always produces the same bytes (clean CDN cache key).

To mint one from the command line:

\`\`\`bash
${pm.effing("url")} annie my-animation \\
  --props '{"text":"Hello"}' \\
  --width ${defaultWidth} --height ${defaultHeight}
\`\`\`

Reads \`BASE_URL\` and \`SECRET_KEY\` from \`.env\`. Width/height default to the first entry in \`dev.resolutions\`. Kind is one of \`image\`, \`annie\`, or \`effie\`; the id matches the fn's filename without the \`.fn.tsx\` suffix.

From inside an effie runner, use \`fnUrl(kind, id, props, bounds)\` from \`@effing/fn\` instead — it signs against the same \`SECRET_KEY\` and returns the same URL shape.`);

  sections.push(`## Environment variables

\`\`\`bash
# Required: base URL the dev/prod server is reachable at
BASE_URL=http://${host}:${port}
# Required: secret for signing URL segments
SECRET_KEY=your-secret-key

# Optional: FFS rendering service (only when pointing at a remote FFS)
FFS_BASE_URL=http://localhost:2000
FFS_API_KEY=your-ffs-api-key
\`\`\`

\`${pm.effing("dev")}\` starts a local FFS sidecar automatically (if \`@effing/ffs\` is installed); the \`FFS_*\` vars only matter when pointing at a remote FFS server.`);

  sections.push(`## CLI commands

| Command | What it does |
| --- | --- |
| \`${pm.effing("dev")}\` | Start the dev server (and a local FFS sidecar if installed). |
| \`${pm.effing("build")}\` | Bundle a production server to \`dist/server.js\`. Run with \`node dist/server.js\`. |
| \`${pm.effing("url <kind> <id>")}\` | Mint a signed fn URL for given props. |
| \`${pm.effing("manual")}\` | Print this manual. |

Your project may wrap these as \`package.json\` scripts under shorter names — check \`package.json\`${guideFile ? ` (and \`${guideFile}\`, which may list them)` : ""}.`);

  sections.push(`## Further reading

Each \`@effing/*\` package ships a README at \`node_modules/@effing/<name>/README.md\`. The most useful when working on a fn:

- \`@effing/effie\` — full Effie format spec (layer types, transitions, effects, source \`#refs\`, backgrounds, motion, validation).
- \`@effing/canvas\` — supported CSS subset for \`renderReactElement\`, plus image and Lottie helpers.
- \`@effing/fn\` — runner contract and \`fnUrl\` semantics.
- \`@effing/tween\` — easing functions and \`tween\` interval shape.
- \`@effing/annie\` — TAR frame format, if you need to consume an annie stream directly.`);

  return sections.join("\n\n") + "\n";
}

function relativeImport(fromDir: string, toFile: string): string {
  let rel = path.relative(fromDir, toFile);
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function renderTreeLines(dirs: Record<FnKind, string | null>): string {
  const lines: string[] = [];
  for (const kind of FN_KINDS) {
    const dir = dirs[kind];
    if (!dir) continue;
    lines.push(
      `├── ${dir.padEnd(24)} # Effing ${KIND_PLURAL[kind]} (\`*.fn.tsx\`)`,
    );
  }
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

function renderImageSection(dir: string): string {
  return `## Creating ${KIND_PLURAL.image}

Drop a file into \`${dir}/\`:

\`\`\`tsx
// ${dir}/my-cover.fn.tsx
import { z } from "zod";
import { createCanvas, renderReactElement } from "@effing/canvas";
import type { RunnerArgs, ImageRunnerReturn } from "@effing/fn";

export const propsSchema = z.object({
  text: z.string(),
});
export type MyCoverProps = z.infer<typeof propsSchema>;

export const previewProps: MyCoverProps = { text: "Hello!" };

export async function runner({
  props: { text },
  bounds: { width, height },
}: RunnerArgs<MyCoverProps>): ImageRunnerReturn {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  await renderReactElement(
    ctx,
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 72,
      }}
    >
      {text}
    </div>,
    { fonts: [] /* see "Fonts" — pass FontData[] to render text */ },
  );
  return canvas.encode("jpeg");
}
\`\`\`

\`renderReactElement\` lays out a React element with CSS flexbox and rasterizes onto the canvas — JSX in, image bytes out. \`@effing/canvas\` is satori-like, but a separate implementation with its own feature set — don't assume satori-only props or features carry over. It supports a subset of CSS; \`node_modules/@effing/canvas/README.md\` documents the subset in detail. You can also draw directly to \`ctx\` with the standard 2D canvas API; \`renderReactElement\` is a layout convenience, not the only way in.

Encode as \`"jpeg"\` for photo-heavy stills, \`"png"\` when you need transparency or crisp text on solid backgrounds.

Endpoints:

- Preview HTML: \`/preview/image/my-cover\`
- Rendered bytes (preview props): \`/preview/image/my-cover.bytes\`
- Rendered bytes (custom props): \`/image/{signed-segment}\``;
}

function renderAnnieSection(dir: string): string {
  return `## Creating ${KIND_PLURAL.annie}

Drop a file into \`${dir}/\`:

\`\`\`tsx
// ${dir}/my-animation.fn.tsx
import { z } from "zod";
import { createCanvas, renderReactElement } from "@effing/canvas";
import { tween, easeOutQuad } from "@effing/tween";
import type { RunnerArgs, AnnieRunnerReturn } from "@effing/fn";

export const propsSchema = z.object({
  text: z.string(),
  frameCount: z.number().int().min(1).optional(),
});
export type MyAnimationProps = z.infer<typeof propsSchema>;

export const previewProps: MyAnimationProps = {
  text: "Hello!",
  frameCount: 60,
};

export async function* runner({
  props: { text, frameCount = 60 },
  bounds: { width, height },
}: RunnerArgs<MyAnimationProps>): AnnieRunnerReturn {
  yield* tween(frameCount, async ({ lower: p }) => {
    const scale = 1 + 0.3 * easeOutQuad(p);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    await renderReactElement(
      ctx,
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 72,
          transform: \`scale(\${scale})\`,
        }}
      >
        {text}
      </div>,
      { fonts: [] /* see "Fonts" */ },
    );
    return canvas.encode("png");
  });
}
\`\`\`

The runner is an async generator that yields one encoded frame at a time. \`tween(count, callback)\` calls the callback \`count\` times — once per frame — and yields whatever buffer it returns. The callback receives \`{ lower, upper }\` — the start and end positions of the frame in the \`[0, 1]\` timeline. For the first frame \`lower\` is \`0\`; for the last \`upper\` is \`1\`. Pass \`lower: p\` to sample at the frame's start, or \`upper: p\` to sample at its end. \`@effing/tween\` exports the standard Penner easing functions (\`easeOutQuad\`, \`easeInOutCubic\`, …) for non-linear motion.

Multi-phase animations chain \`yield* tween(...)\` blocks back-to-back — one tween per phase, e.g. a typing phase followed by a blinking-cursor phase in a typewriter animation.

Encode each frame as \`"png"\` for text/alpha-heavy frames, \`"jpeg"\` for photo-heavy frames — JPEG is typically faster to encode and smaller on the wire, which adds up across an animation.

Endpoints:

- Preview HTML: \`/preview/annie/my-animation\`
- TAR stream (preview props): \`/preview/annie/my-animation.tar\`
- TAR stream (custom props): \`/annie/{signed-segment}\`

Frames are streamed as they're rendered, so the TAR endpoint won't time out behind a CDN even for long animations.`;
}

function renderEffieSection(dir: string, annieDir: string | null): string {
  const annieImport = annieDir
    ? relativeImport(dir, `${annieDir}/my-animation.fn`)
    : "./my-animation.fn";
  return `## Creating ${KIND_PLURAL.effie}

An effie is a sequence of segments holding image and animation layers, optional segment-level audio, and optional transitions between segments. The runner returns a *description* of the composition — an \`effieData\` value — not rendered pixels. Rendering happens separately by FFS, which fetches the layer URLs and assembles the MP4.

Drop a file into \`${dir}/\`:

\`\`\`tsx
// ${dir}/my-video.fn.tsx
import { z } from "zod";
import { effieData, effieSegment } from "@effing/effie";
import { fnUrl } from "@effing/fn";
import type { RunnerArgs, EffieRunnerReturn } from "@effing/fn";
import type { MyAnimationProps } from "${annieImport}";

export const propsSchema = z.object({
  title: z.string(),
  imageUrl: z.string().url(),
});
type MyVideoProps = z.infer<typeof propsSchema>;

export const previewProps: MyVideoProps = {
  title: "My Video",
  imageUrl: "https://picsum.photos/1080/1920",
};

export async function runner({
  props: { title, imageUrl },
  bounds: { width, height },
}: RunnerArgs<MyVideoProps>): EffieRunnerReturn {
  return effieData({
    width,
    height,
    fps: 30,
    cover: imageUrl,
    background: { type: "color", color: "black" },
    segments: [
      effieSegment({
        duration: 5,
        layers: [
          {
            type: "animation",
            source: await fnUrl(
              "annie",
              "my-animation",
              {
                text: title,
                frameCount: 150,
              } satisfies MyAnimationProps,
              { width, height },
            ),
          },
        ],
      }),
    ],
  });
}
\`\`\`

A few things to know:

- **Independent elements belong on their own layers.** Use one layer per visually independent element (each its own image or annie fn) so each can fade, transition, and be cached independently. Elements that stay constant across segments can be defined once in \`effieData.sources\` and referenced as \`"#name"\` from each segment — see the \`@effing/effie\` README for \`#ref\` semantics.
- **\`fnUrl(kind, id, props, bounds)\`** returns a signed URL pointing at another fn's output. The renderer fetches it when it needs the layer's pixels. Always run the dependency's props through \`satisfies <DependencyProps>\` (here, \`satisfies MyAnimationProps\`) — typos in prop names then fail the typecheck instead of silently producing a broken URL at runtime.
- **Bounds for child fns can differ from the effie's own bounds.** Useful when an effect needs over-canvas content — e.g. passing \`{ width: width * 1.2, height }\` to a child annie so it has horizontal slack for a \`scroll\` effect that pans across.
- **Transitions overlap the previous segment.** A \`transition.duration\` of \`T\` means the new segment starts \`T\` seconds *before* the segment boundary and the transition ends at the boundary. Layer timing (\`delay\`, \`from\`, effect/motion \`start\`) in the new segment is measured from that earlier start, so a layer with \`delay: 0\` is on-screen during the transition.
- **For the full format vocabulary** — layer types, transitions, effects, backgrounds, motion, validation — see \`node_modules/@effing/effie/README.md\`. This manual only covers the basics.

To debug a composition, work down from the description before rendering: read the effie JSON, then fetch the individual layer sources it references, and reach for a full MP4 render only for whole-timeline questions — see "Inspecting from an agent".

Endpoints:

- Preview HTML: \`/preview/effie/my-video\`
- JSON (preview props): \`/preview/effie/my-video.json\`
- JSON (custom props): \`/effie/{signed-segment}\``;
}
