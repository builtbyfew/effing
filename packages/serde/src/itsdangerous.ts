/**
 * TypeScript implementation of itsdangerous serialization logic.
 * @see https://github.com/pallets/itsdangerous/
 */

import zlib from "node:zlib";
import { promisify } from "node:util";
import { createHash, createHmac } from "node:crypto";

const zip = promisify(zlib.gzip);
const unzip = promisify(zlib.unzip);

/**
 * Encode data as URL-safe base64.
 * Replaces + with - and / with _ by default.
 */
export function urlsafeBase64Encode(
  data: string | Buffer,
  unsafeCharsMapping: Record<string, string> = { "+": "-", "/": "_" },
): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/[+/]/g, (m) => unsafeCharsMapping[m]);
}

/**
 * Decode URL-safe base64 data.
 * Replaces - with + and _ with / by default.
 */
export function urlsafeBase64Decode(
  encoded: string,
  unsafeCharsMapping: Record<string, string> = { "-": "+", _: "/" },
): Buffer {
  return Buffer.from(
    encoded.replace(/[-_]/g, (m) => unsafeCharsMapping[m]),
    "base64",
  );
}

/**
 * Derive an HMAC signing key using the itsdangerous-compatible format.
 */
function deriveSigningKey(
  secretKey: string,
  salt: string,
  algorithm: string,
): Buffer {
  return createHash(algorithm).update(`${salt}signer${secretKey}`).digest();
}

/**
 * Convert snake_case keys to camelCase.
 */
function keysToCamel<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const newObj: Record<string, unknown> = {};
  Object.keys(obj).forEach((key) => {
    const camelKey = key.replace(/(_[a-z])/gi, (s) =>
      s.toUpperCase().replace("_", ""),
    );
    newObj[camelKey] = obj[key];
  });
  return newObj;
}

export interface SerializeOptions {
  /** Salt for key derivation (default: "itsdangerous") */
  salt?: string;
  /** Hash algorithm for HMAC (default: "sha1") */
  algorithm?: string;
}

/**
 * Serialize an object to a URL-safe segment with optional compression and HMAC signature.
 *
 * The format is compatible with Python's itsdangerous library.
 * - If compression saves space, the payload is prefixed with "."
 * - The signature is appended after a "." separator
 */
export async function serialize(
  obj: object,
  secretKey: string,
  options: SerializeOptions = {},
): Promise<string> {
  const { salt = "itsdangerous", algorithm = "sha1" } = options;

  let json = Buffer.from(JSON.stringify(obj));
  const compressed = await zip(json);

  let isCompressed = false;
  if (compressed.length < json.length - 1) {
    json = compressed;
    isCompressed = true;
  }

  let encoded = urlsafeBase64Encode(json);
  if (isCompressed) {
    encoded = `.${encoded}`;
  }

  const derivedKey = deriveSigningKey(secretKey, salt, algorithm);
  const hmac = createHmac(algorithm, derivedKey).update(encoded).digest();
  return `${encoded}.${urlsafeBase64Encode(hmac)}`;
}

export interface DeserializeOptions extends SerializeOptions {
  /** Whether to convert snake_case keys to camelCase (default: true) */
  convertKeysToCamel?: boolean;
}

/**
 * Deserialize a URL segment, verify its signature, and decompress if needed.
 *
 * Throws an error if the signature is invalid.
 */
export async function deserialize<T = Record<string, unknown>>(
  segment: string,
  secretKey: string,
  options: DeserializeOptions = {},
): Promise<T> {
  const {
    salt = "itsdangerous",
    algorithm = "sha1",
    convertKeysToCamel = true,
  } = options;

  const parts = segment.split(".");
  const signature = parts.at(-1);
  let payload = parts.slice(0, -1).join(".");

  const derivedKey = deriveSigningKey(secretKey, salt, algorithm);
  const hmac = createHmac(algorithm, derivedKey).update(payload).digest();
  if (Buffer.compare(urlsafeBase64Decode(signature!), hmac) !== 0) {
    throw new Error("invalid url segment signature");
  }

  let decompress = false;
  if (payload.startsWith(".")) {
    decompress = true;
    payload = payload.slice(1);
  }

  const decoded = urlsafeBase64Decode(payload);
  let parsed: Record<string, unknown>;

  if (decompress) {
    const decompressed = await unzip(decoded);
    parsed = JSON.parse(decompressed.toString()) as Record<string, unknown>;
  } else {
    parsed = JSON.parse(decoded.toString()) as Record<string, unknown>;
  }

  if (convertKeysToCamel) {
    return keysToCamel(parsed) as T;
  }
  return parsed as T;
}
