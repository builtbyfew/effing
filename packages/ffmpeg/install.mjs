import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, chmod, readFile, rename, rm } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLATFORM_MAP = {
  darwin: "darwin",
  linux: "linux",
  win32: "win32",
};

const ARCH_MAP = {
  x64: "x64",
  ia32: "ia32",
  arm64: "arm64",
  arm: "arm",
};

const SUPPORTED = new Set([
  "darwin-x64",
  "darwin-arm64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
]);

const platform = PLATFORM_MAP[os.platform()];
const arch = ARCH_MAP[os.arch()];

if (!platform || !arch || !SUPPORTED.has(`${platform}-${arch}`)) {
  console.warn(
    `@effing/ffmpeg: unsupported platform ${os.platform()}-${os.arch()}, skipping binary download`,
  );
  process.exit(0);
}

const binaryName = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
const binaryPath = path.join(__dirname, binaryName);

// FFmpeg version to download. Keep checksums.json in sync when bumping.
const FFMPEG_VERSION = "9.0.1";

const customBaseUrl = process.env.FFMPEG_BINARIES_URL;
const baseUrl =
  customBaseUrl ||
  `https://github.com/builtbyfew/effing-ffmpeg-builds/releases/download/v${FFMPEG_VERSION}`;

// Skip if a binary already exists, unless it reports a different version than
// the one pinned above (a stale binary would otherwise silently survive every
// version bump). Custom builds served via FFMPEG_BINARIES_URL are trusted as-is.
try {
  await access(binaryPath);
  let existingVersion = "unknown";
  try {
    existingVersion =
      execFileSync(binaryPath, ["-version"], { encoding: "utf8" })
        .split("\n")[0]
        .match(/^ffmpeg version (\S+)/)?.[1] ?? "unknown";
  } catch {
    // Not executable or broken; treat as stale and re-download below.
  }
  if (customBaseUrl || existingVersion === FFMPEG_VERSION) {
    console.log(
      `@effing/ffmpeg: binary already exists at ${binaryPath} (version ${existingVersion})`,
    );
    process.exit(0);
  }
  console.log(
    `@effing/ffmpeg: existing binary is version ${existingVersion}, expected ${FFMPEG_VERSION}; re-downloading`,
  );
  await rm(binaryPath, { force: true });
} catch {
  // Binary doesn't exist, proceed with download
}

const url = `${baseUrl}/ffmpeg-${platform}-${arch}.gz`;

console.log(`@effing/ffmpeg: downloading ffmpeg from ${url}`);

/**
 * Follow redirects (GitHub releases redirect to S3/CDN).
 * Returns a readable response stream.
 */
function get(url, redirects = 0) {
  if (redirects > 5) {
    throw new Error("Too many redirects");
  }
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume(); // discard body
          resolve(get(res.headers.location, redirects + 1));
        } else if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(`Download failed: HTTP ${res.statusCode} for ${url}`),
          );
        } else {
          resolve(res);
        }
      })
      .on("error", reject);
  });
}

try {
  const skipChecksum = process.env.FFMPEG_SKIP_CHECKSUM === "1";
  let expected;
  if (!skipChecksum) {
    const checksums = JSON.parse(
      await readFile(new URL("./checksums.json", import.meta.url), "utf8"),
    );
    expected = checksums[`${platform}-${arch}`];
    if (!expected) {
      throw new Error(
        `no pinned checksum for ${platform}-${arch} (set FFMPEG_SKIP_CHECKSUM=1 to bypass verification)`,
      );
    }
  }

  const response = await get(url);
  const gunzip = zlib.createGunzip();
  const hash = createHash("sha256");
  gunzip.on("data", (chunk) => hash.update(chunk));

  // Download to a temp path and rename into place only after verification,
  // so a failed run never leaves a partial or unverified binary behind
  // (the installer skips the download when binaryPath already exists).
  const tmpPath = `${binaryPath}.download`;
  try {
    await pipeline(response, gunzip, createWriteStream(tmpPath));

    if (!skipChecksum) {
      const actual = hash.digest("hex");
      if (actual !== expected) {
        throw new Error(
          `checksum mismatch for ${platform}-${arch} (expected ${expected}, got ${actual}); ` +
            `if you intentionally provide a custom build via FFMPEG_BINARIES_URL, set FFMPEG_SKIP_CHECKSUM=1`,
        );
      }
    } else {
      console.warn(
        "@effing/ffmpeg: FFMPEG_SKIP_CHECKSUM=1 set, skipping checksum verification",
      );
    }

    await rename(tmpPath, binaryPath);
  } catch (err) {
    await rm(tmpPath, { force: true });
    throw err;
  }

  await chmod(binaryPath, 0o755);

  console.log(`@effing/ffmpeg: binary installed to ${binaryPath}`);
} catch (err) {
  console.error(`@effing/ffmpeg: failed to download binary: ${err.message}`);
  process.exit(1);
}
