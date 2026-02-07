import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const platform = os.platform();
const arch = os.arch();
const key = `${platform}-${arch}`;

const binaryName = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

const ffmpegPath: string | null = SUPPORTED.has(key)
  ? path.join(__dirname, "..", binaryName)
  : null;

export const pathToFFmpeg = ffmpegPath;
