import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import type { Readable } from "stream";

/** Default TTL: 60 minutes */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * Transient store interface for caching sources and storing ephemeral job data.
 */
export interface TransientStore {
  /** TTL in milliseconds */
  readonly ttlMs: number;
  /** Store a stream with the given key and optional TTL override */
  put(key: string, stream: Readable, ttlMs?: number): Promise<void>;
  /** Get a stream for the given key, or null if not found */
  getStream(key: string): Promise<Readable | null>;
  /** Check if a key exists */
  exists(key: string): Promise<boolean>;
  /** Check if multiple keys exist (batch operation) */
  existsMany(keys: string[]): Promise<Map<string, boolean>>;
  /** Delete a key */
  delete(key: string): Promise<void>;
  /** Store JSON data with optional TTL override */
  putJson(key: string, data: object, ttlMs?: number): Promise<void>;
  /** Get JSON data, or null if not found */
  getJson<T>(key: string): Promise<T | null>;
  /** Close and cleanup resources */
  close(): void;
}

/**
 * S3-compatible transient store implementation
 */
export class S3TransientStore implements TransientStore {
  private client: S3Client;
  private bucket: string;
  private prefix: string;
  public readonly ttlMs: number;

  constructor(options: {
    endpoint?: string;
    region?: string;
    bucket: string;
    prefix?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    ttlMs?: number;
  }) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region ?? "auto",
      credentials: options.accessKeyId
        ? {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey!,
          }
        : undefined,
      forcePathStyle: !!options.endpoint,
    });
    this.bucket = options.bucket;
    this.prefix = (options.prefix ?? "").replace(/\/+$/, "");
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  private getExpires(ttlMs: number): Date {
    return new Date(Date.now() + ttlMs);
  }

  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async put(key: string, stream: Readable, ttlMs?: number): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: this.getFullKey(key),
        Body: stream,
        Expires: this.getExpires(ttlMs ?? this.ttlMs),
      },
    });
    await upload.done();
  }

  async getStream(key: string): Promise<Readable | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.getFullKey(key),
        }),
      );
      return response.Body as Readable;
    } catch (err: unknown) {
      const error = err as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.getFullKey(key),
        }),
      );
      return true;
    } catch (err: unknown) {
      const error = err as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  async existsMany(keys: string[]): Promise<Map<string, boolean>> {
    const results = await Promise.all(
      keys.map(async (key) => [key, await this.exists(key)] as const),
    );
    return new Map(results);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.getFullKey(key),
        }),
      );
    } catch (err: unknown) {
      const error = err as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return;
      }
      throw err;
    }
  }

  async putJson(key: string, data: object, ttlMs?: number): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.getFullKey(key),
        Body: JSON.stringify(data),
        ContentType: "application/json",
        Expires: this.getExpires(ttlMs ?? this.ttlMs),
      }),
    );
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.getFullKey(key),
        }),
      );
      const body = await response.Body?.transformToString();
      if (!body) return null;
      return JSON.parse(body) as T;
    } catch (err: unknown) {
      const error = err as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  close(): void {
    // nothing to do here
  }
}

/**
 * Local filesystem transient store implementation
 */
export class LocalTransientStore implements TransientStore {
  private baseDir: string;
  private initialized = false;
  private cleanupInterval?: ReturnType<typeof setInterval>;
  public readonly ttlMs: number;

  constructor(options?: { baseDir?: string; ttlMs?: number }) {
    this.baseDir = options?.baseDir ?? path.join(os.tmpdir(), "ffs-transient");
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

    // Cleanup expired files every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired().catch(console.error);
    }, 300_000);
  }

  /**
   * Remove files older than max TTL
   */
  public async cleanupExpired(): Promise<void> {
    if (!this.initialized) return;

    const now = Date.now();
    await this.cleanupDir(this.baseDir, now);
  }

  private async cleanupDir(dir: string, now: number): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Directory doesn't exist or can't be read
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.cleanupDir(fullPath, now);
        // Remove empty directories
        try {
          await fs.rmdir(fullPath);
        } catch {
          // Directory not empty or other error, ignore
        }
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          if (now - stat.mtimeMs > this.ttlMs) {
            await fs.rm(fullPath, { force: true });
          }
        } catch {
          // File may have been deleted, ignore
        }
      }
    }
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    this.initialized = true;
  }

  private filePath(key: string): string {
    return path.join(this.baseDir, key);
  }

  private tmpPathFor(finalPath: string): string {
    const rand = crypto.randomBytes(8).toString("hex");
    // Keep tmp file in the same directory so rename stays atomic on POSIX filesystems.
    return `${finalPath}.tmp-${process.pid}-${rand}`;
  }

  async put(key: string, stream: Readable, _ttlMs?: number): Promise<void> {
    // Note: TTL is not used for local storage; cleanup uses file mtime
    const fp = this.filePath(key);
    await this.ensureDir(fp);

    // Write to temp file, then rename for atomicity (no partial reads).
    const tmpPath = this.tmpPathFor(fp);
    try {
      const writeStream = createWriteStream(tmpPath);
      await pipeline(stream, writeStream);
      await fs.rename(tmpPath, fp);
    } catch (err) {
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
  }

  async getStream(key: string): Promise<Readable | null> {
    const fp = this.filePath(key);
    if (!existsSync(fp)) return null;
    return createReadStream(fp);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async existsMany(keys: string[]): Promise<Map<string, boolean>> {
    const results = await Promise.all(
      keys.map(async (key) => [key, await this.exists(key)] as const),
    );
    return new Map(results);
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.filePath(key), { force: true });
  }

  async putJson(key: string, data: object, _ttlMs?: number): Promise<void> {
    // Note: TTL is not used for local storage; cleanup uses file mtime
    const fp = this.filePath(key);
    await this.ensureDir(fp);

    // Write to temp file, then rename for atomicity (no partial reads).
    const tmpPath = this.tmpPathFor(fp);
    try {
      await fs.writeFile(tmpPath, JSON.stringify(data));
      await fs.rename(tmpPath, fp);
    } catch (err) {
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const content = await fs.readFile(this.filePath(key), "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  close(): void {
    // Stop the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Create a transient store instance based on environment variables.
 * Uses S3 if FFS_TRANSIENT_STORE_BUCKET is set, otherwise uses local filesystem.
 */
export function createTransientStore(): TransientStore {
  const ttlMs = process.env.FFS_TRANSIENT_STORE_TTL_MS
    ? parseInt(process.env.FFS_TRANSIENT_STORE_TTL_MS, 10)
    : DEFAULT_TTL_MS;

  if (process.env.FFS_TRANSIENT_STORE_BUCKET) {
    return new S3TransientStore({
      endpoint: process.env.FFS_TRANSIENT_STORE_ENDPOINT,
      region: process.env.FFS_TRANSIENT_STORE_REGION ?? "auto",
      bucket: process.env.FFS_TRANSIENT_STORE_BUCKET,
      prefix: process.env.FFS_TRANSIENT_STORE_PREFIX,
      accessKeyId: process.env.FFS_TRANSIENT_STORE_ACCESS_KEY,
      secretAccessKey: process.env.FFS_TRANSIENT_STORE_SECRET_KEY,
      ttlMs,
    });
  }

  return new LocalTransientStore({
    baseDir: process.env.FFS_TRANSIENT_STORE_LOCAL_DIR,
    ttlMs,
  });
}

export function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

export type SourceStoreKey = `sources/${string}`;
export type WarmupJobStoreKey = `jobs/warmup/${string}.json`;
export type RenderJobStoreKey = `jobs/render/${string}.json`;
export type VideoJobStoreKey = `jobs/video/${string}.json`;

/**
 * Build the store key for a source URL (hashing is handled internally).
 */
export function sourceStoreKey(url: string): SourceStoreKey {
  return `sources/${hashUrl(url)}`;
}

export function warmupJobStoreKey(jobId: string): WarmupJobStoreKey {
  return `jobs/warmup/${jobId}.json`;
}

export function renderJobStoreKey(jobId: string): RenderJobStoreKey {
  return `jobs/render/${jobId}.json`;
}

export function videoJobStoreKey(jobId: string): VideoJobStoreKey {
  return `jobs/video/${jobId}.json`;
}

/**
 * Centralized store key builders for known namespaces.
 * Prefer using these helpers over manual string interpolation.
 */
export const storeKeys = {
  source: sourceStoreKey,
  warmupJob: warmupJobStoreKey,
  renderJob: renderJobStoreKey,
  videoJob: videoJobStoreKey,
} as const;
