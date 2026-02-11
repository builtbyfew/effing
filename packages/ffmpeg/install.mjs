import { createWriteStream } from "node:fs";
import { access, chmod } from "node:fs/promises";
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
  "linux-ia32",
  "linux-arm64",
  "linux-arm",
  "win32-x64",
  "win32-ia32",
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

// Skip if binary already exists
try {
  await access(binaryPath);
  console.log(`@effing/ffmpeg: binary already exists at ${binaryPath}`);
  process.exit(0);
} catch {
  // Binary doesn't exist, proceed with download
}

const baseUrl =
  process.env.FFMPEG_BINARIES_URL ||
  "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0";

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
  const response = await get(url);
  const gunzip = zlib.createGunzip();
  const file = createWriteStream(binaryPath);

  await pipeline(response, gunzip, file);
  await chmod(binaryPath, 0o755);

  console.log(`@effing/ffmpeg: binary installed to ${binaryPath}`);
} catch (err) {
  console.error(`@effing/ffmpeg: failed to download binary: ${err.message}`);
  process.exit(1);
}
