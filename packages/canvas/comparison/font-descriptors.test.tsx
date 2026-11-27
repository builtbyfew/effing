import { beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, deflateSync } from "node:zlib";
import type { FontData } from "../src/types.ts";
import { weightAxisRange } from "../src/jsx/font-axes.ts";

// ---------------------------------------------------------------------------
// @effing/skia matches a family's registered faces by their @font-face
// descriptors, and a face registered without any counts as a normal one.
// registerFont passes each FontData's weight and style (a variable font's
// whole weight axis), and registerFontFromPath takes them as its third
// argument. Every scenario registers under its own family name.
// ---------------------------------------------------------------------------

const FONT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "_helpers",
  "fonts",
);
const TEXT = "Andilly (95)";
const W = 600;
const H = 100;

type Api = typeof import("../src/index.ts");

/** A WOFF holding the TrueType file's tables, each compressed. */
function toWoff(ttf: Buffer): Buffer {
  const numTables = ttf.readUInt16BE(4);
  const tables = Array.from({ length: numTables }, (_, i) => {
    const record = 12 + 16 * i;
    const offset = ttf.readUInt32BE(record + 8);
    const length = ttf.readUInt32BE(record + 12);
    const data = ttf.subarray(offset, offset + length);
    const compressed = deflateSync(data);
    return {
      tag: ttf.readUInt32BE(record),
      checksum: ttf.readUInt32BE(record + 4),
      data: compressed.length < length ? compressed : data,
      origLength: length,
    };
  });
  const header = Buffer.alloc(44 + 20 * numTables);
  header.writeUInt32BE(0x774f4646, 0);
  header.writeUInt32BE(ttf.readUInt32BE(0), 4);
  header.writeUInt16BE(numTables, 12);
  let offset = header.length;
  const bodies: Buffer[] = [];
  tables.forEach((table, i) => {
    const entry = 44 + 20 * i;
    header.writeUInt32BE(table.tag, entry);
    header.writeUInt32BE(offset, entry + 4);
    header.writeUInt32BE(table.data.length, entry + 8);
    header.writeUInt32BE(table.origLength, entry + 12);
    header.writeUInt32BE(table.checksum, entry + 16);
    const padded = Buffer.alloc((table.data.length + 3) & ~3);
    table.data.copy(padded);
    bodies.push(padded);
    offset += padded.length;
  });
  const woff = Buffer.concat([header, ...bodies]);
  woff.writeUInt32BE(woff.length, 8);
  return woff;
}

/** The tables of a TrueType file, in its directory's order. */
function sfntTables(ttf: Buffer) {
  return Array.from({ length: ttf.readUInt16BE(4) }, (_, i) => {
    const record = 12 + 16 * i;
    const offset = ttf.readUInt32BE(record + 8);
    const length = ttf.readUInt32BE(record + 12);
    return {
      tag: ttf.toString("latin1", record, record + 4),
      data: ttf.subarray(offset, offset + length),
    };
  });
}

/**
 * A WOFF2 holding the TrueType file's tables untransformed (enough for the
 * axis reader; every table is given by its tag).
 */
function toWoff2(ttf: Buffer): Buffer {
  const tables = sfntTables(ttf);
  const base128 = (n: number) => {
    const bytes = [n & 0x7f];
    for (n = Math.floor(n / 128); n > 0; n = Math.floor(n / 128)) {
      bytes.unshift((n & 0x7f) | 0x80);
    }
    return bytes;
  };
  const directory: number[] = [];
  for (const { tag, data } of tables) {
    // Tag 63: an explicit tag. glyf and loca are untransformed at version 3.
    const version = tag === "glyf" || tag === "loca" ? 3 : 0;
    directory.push((version << 6) | 0x3f, ...Buffer.from(tag, "latin1"));
    directory.push(...base128(data.length));
  }
  const stream = brotliCompressSync(Buffer.concat(tables.map((t) => t.data)));
  const header = Buffer.alloc(48);
  header.writeUInt32BE(0x774f4632, 0);
  header.writeUInt32BE(ttf.readUInt32BE(0), 4);
  header.writeUInt16BE(tables.length, 12);
  header.writeUInt32BE(ttf.length, 16);
  header.writeUInt32BE(stream.length, 20);
  const woff2 = Buffer.concat([header, Buffer.from(directory), stream]);
  woff2.writeUInt32BE(woff2.length, 8);
  return woff2;
}

/** The TrueType file with its wght axis's minimum set to `min`. */
function withWeightMin(ttf: Buffer, min: number): Buffer {
  const copy = Buffer.from(ttf);
  const fvar = sfntTables(copy).find((t) => t.tag === "fvar")!;
  const start = fvar.data.byteOffset - copy.byteOffset;
  const axes = start + copy.readUInt16BE(start + 4);
  for (let i = 0; i < copy.readUInt16BE(start + 8); i++) {
    const axis = axes + copy.readUInt16BE(start + 10) * i;
    if (copy.toString("latin1", axis, axis + 4) === "wght") {
      copy.writeInt32BE(min * 65536, axis + 4);
    }
  }
  return copy;
}

describe("font descriptors", () => {
  let api: Api;
  let variable: Buffer;
  let regular: Buffer;
  let bold: Buffer;
  let counter = 0;
  const family = (what: string) => `Descriptors ${what} ${++counter}`;

  /** Draw TEXT at the weight and return its pixels. */
  function draw(name: string, weight: number): Uint8ClampedArray {
    const ctx = api.createCanvas(W, H).getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "black";
    ctx.font = `${weight} 48px "${name}"`;
    ctx.fillText(TEXT, 10, 70);
    return ctx.getImageData(0, 0, W, H).data;
  }

  beforeAll(async () => {
    api = await import("../src/index.ts");
    variable = await readFile(
      join(FONT_DIR, "RobotoMono-VariableFont_wght.ttf"),
    );
    regular = await readFile(join(FONT_DIR, "LiberationSans-Regular.woff"));
    bold = await readFile(join(FONT_DIR, "LiberationSans-Bold.woff"));
  });

  it("reads a variable font's weight axis from TrueType and WOFF, and none from a static font", () => {
    expect(weightAxisRange(variable)).toEqual([100, 700]);
    expect(weightAxisRange(toWoff(variable))).toEqual([100, 700]);
    expect(weightAxisRange(toWoff2(variable))).toEqual([100, 700]);
    expect(weightAxisRange(regular)).toBeNull();
    expect(weightAxisRange(Buffer.from("not a font"))).toBeNull();
  });

  it("draws each weight of a variable font registered once as its own instance", () => {
    // The reference: the file registered without descriptors, which matches
    // every weight and sets its wght axis to the weight asked for.
    const reference = family("variable reference");
    api.GlobalFonts.register(variable, reference);
    // Pinned to one weight, the face draws a synthesized bold at 700.
    const pinned = family("variable pinned");
    api.GlobalFonts.register(variable, pinned, { weight: 400 });

    const name = family("variable");
    const font: FontData = {
      name,
      data: variable,
      weight: 400,
      style: "normal",
    };
    api.registerFont(font);

    expect(draw(pinned, 700)).not.toEqual(draw(reference, 700));
    for (const weight of [300, 400, 700]) {
      expect(draw(name, weight)).toEqual(draw(reference, weight));
    }
  });

  it("registers a variable font whose weight axis goes beyond 1-1000", () => {
    const offSpec = withWeightMin(variable, 0);
    expect(weightAxisRange(offSpec)).toEqual([0, 700]);
    const reference = family("off-spec reference");
    api.GlobalFonts.register(offSpec, reference);

    const name = family("off-spec");
    api.registerFont({ name, data: offSpec, weight: 400, style: "normal" });
    expect(api.registeredFamilies()).toContain(name);
    for (const weight of [100, 700]) {
      expect(draw(name, weight)).toEqual(draw(reference, weight));
    }
  });

  it("keeps each static face of a family registered from paths with its descriptors", async () => {
    const dir = await mkdtemp(join(tmpdir(), "effing-font-descriptors-"));
    try {
      const regularPath = join(dir, "regular.woff");
      const boldPath = join(dir, "bold.woff");
      await writeFile(regularPath, regular);
      await writeFile(boldPath, bold);

      const reference = family("static reference");
      api.registerFont({
        name: reference,
        data: regular,
        weight: 400,
        style: "normal",
      });
      api.registerFont({
        name: reference,
        data: bold,
        weight: 700,
        style: "normal",
      });
      expect(draw(reference, 400)).not.toEqual(draw(reference, 700));

      const name = family("static paths");
      api.registerFontFromPath(regularPath, name, { weight: 400 });
      api.registerFontFromPath(boldPath, name, { weight: 700 });
      for (const weight of [400, 700]) {
        expect(draw(name, weight)).toEqual(draw(reference, weight));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
