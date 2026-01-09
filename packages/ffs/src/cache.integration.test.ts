import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import { LocalCacheStorage, createCacheStorage, S3CacheStorage } from "./cache";
import { Readable } from "stream";
import fs from "fs/promises";
import path from "path";
import os from "os";

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe("LocalCacheStorage", () => {
  let tempDir: string;
  let storage: LocalCacheStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffs-cache-test-"));
    storage = new LocalCacheStorage(tempDir, 60 * 60 * 1000);
  });

  afterEach(async () => {
    storage.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("put and getStream", () => {
    test("stores and retrieves stream data", async () => {
      const data = Buffer.from("test cache data");
      const stream = Readable.from(data);

      await storage.put("test-file", stream);

      const retrieved = await storage.getStream("test-file");
      expect(retrieved).not.toBeNull();

      const result = await readAll(retrieved!);
      expect(result.toString()).toBe("test cache data");
    });

    test("is atomic: final path is only visible after stream completes", async () => {
      const stream = Readable.from(
        (async function* () {
          yield Buffer.from("hello ");
          await new Promise((r) => setTimeout(r, 100));
          yield Buffer.from("world");
        })(),
      );

      const putPromise = storage.put("atomic-file", stream);

      // During write: the final path should not exist / be readable.
      await new Promise((r) => setTimeout(r, 20));
      expect(await storage.exists("atomic-file")).toBe(false);
      expect(await storage.getStream("atomic-file")).toBeNull();

      await putPromise;

      expect(await storage.exists("atomic-file")).toBe(true);
      const retrieved = await storage.getStream("atomic-file");
      expect(retrieved).not.toBeNull();
      const result = await readAll(retrieved!);
      expect(result.toString()).toBe("hello world");
    });

    test("stores nested paths", async () => {
      const data = Buffer.from("nested data");
      const stream = Readable.from(data);

      await storage.put("sources/abc123", stream);

      const retrieved = await storage.getStream("sources/abc123");
      expect(retrieved).not.toBeNull();

      const result = await readAll(retrieved!);
      expect(result.toString()).toBe("nested data");
    });

    test("returns null for non-existent file", async () => {
      const result = await storage.getStream("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("exists", () => {
    test("returns true for existing file", async () => {
      await storage.put("exists-test", Readable.from(Buffer.from("data")));

      const result = await storage.exists("exists-test");
      expect(result).toBe(true);
    });

    test("returns false for non-existent file", async () => {
      const result = await storage.exists("does-not-exist");
      expect(result).toBe(false);
    });
  });

  describe("existsMany", () => {
    test("returns map of existence checks", async () => {
      await storage.put("file1", Readable.from(Buffer.from("data1")));
      await storage.put("file3", Readable.from(Buffer.from("data3")));

      const result = await storage.existsMany(["file1", "file2", "file3"]);

      expect(result.get("file1")).toBe(true);
      expect(result.get("file2")).toBe(false);
      expect(result.get("file3")).toBe(true);
    });
  });

  describe("delete", () => {
    test("deletes existing file", async () => {
      await storage.put("to-delete", Readable.from(Buffer.from("data")));
      expect(await storage.exists("to-delete")).toBe(true);

      await storage.delete("to-delete");

      expect(await storage.exists("to-delete")).toBe(false);
    });

    test("does not throw for non-existent file", async () => {
      await expect(storage.delete("non-existent")).resolves.toBeUndefined();
    });
  });

  describe("putJson and getJson", () => {
    test("stores and retrieves JSON data", async () => {
      const data = { foo: "bar", count: 42, nested: { a: 1 } };

      await storage.putJson("metadata.json", data);

      const result = await storage.getJson<typeof data>("metadata.json");
      expect(result).toEqual(data);
    });

    test("returns null for non-existent JSON file", async () => {
      const result = await storage.getJson("non-existent.json");
      expect(result).toBeNull();
    });

    test("stores JSON in nested paths", async () => {
      const data = { status: "ready" };

      await storage.putJson("jobs/abc123.json", data);

      const result = await storage.getJson<typeof data>("jobs/abc123.json");
      expect(result).toEqual(data);
    });
  });

  describe("close", () => {
    test("stops cleanup interval", async () => {
      const testStorage = new LocalCacheStorage(tempDir);

      // Should not throw
      testStorage.close();

      // Calling close again should also be safe
      testStorage.close();
    });
  });
});

describe("LocalCacheStorage TTL cleanup", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ffs-cache-ttl-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("cleans up files older than TTL", async () => {
    // Create storage with very short TTL (1ms)
    const storage = new LocalCacheStorage(tempDir, 1);

    // Store a file
    await storage.put("old-file", Readable.from(Buffer.from("old data")));

    // Verify that the file exists initially
    expect(await storage.exists("old-file")).toBe(true);

    // Make the file deterministically "older than TTL" (avoid time-based sleeps)
    const fp = path.join(tempDir, "old-file");
    const old = new Date(Date.now() - 10_000);
    await fs.utimes(fp, old, old);

    await storage.cleanupExpired();

    // Verify that the file is deleted
    expect(await storage.exists("old-file")).toBe(false);

    // Close the storage
    storage.close();
  });
});

describe("createCacheStorage", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset relevant env vars
    delete process.env.FFS_CACHE_BUCKET;
    delete process.env.FFS_CACHE_ENDPOINT;
    delete process.env.FFS_CACHE_REGION;
    delete process.env.FFS_CACHE_PREFIX;
    delete process.env.FFS_CACHE_ACCESS_KEY;
    delete process.env.FFS_CACHE_SECRET_KEY;
    delete process.env.FFS_CACHE_LOCAL_DIR;
    delete process.env.FFS_CACHE_TTL_MS;
  });

  afterAll(() => {
    // Restore original env without reassigning `process.env` (Node treats it specially).
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test("returns LocalCacheStorage when FFS_CACHE_BUCKET is not set", () => {
    const storage = createCacheStorage();

    expect(storage).toBeInstanceOf(LocalCacheStorage);
    storage.close();
  });

  test("returns S3CacheStorage when FFS_CACHE_BUCKET is set", () => {
    process.env.FFS_CACHE_BUCKET = "my-bucket";

    const storage = createCacheStorage();

    expect(storage).toBeInstanceOf(S3CacheStorage);
    expect((storage as unknown as { bucket: string }).bucket).toBe("my-bucket");
    storage.close();
  });

  test("passes S3 configuration from environment", () => {
    process.env.FFS_CACHE_BUCKET = "my-bucket";
    process.env.FFS_CACHE_ENDPOINT = "https://s3.example.com";
    process.env.FFS_CACHE_REGION = "us-west-2";
    process.env.FFS_CACHE_PREFIX = "cache/v1/";
    process.env.FFS_CACHE_ACCESS_KEY = "access-key";
    process.env.FFS_CACHE_SECRET_KEY = "secret-key";
    process.env.FFS_CACHE_TTL_MS = "1800000";

    const storage = createCacheStorage();

    // Can't easily verify S3 client config, but we can verify it's an S3 storage
    expect(storage).toBeInstanceOf(S3CacheStorage);
    expect((storage as unknown as { bucket: string }).bucket).toBe("my-bucket");
    expect((storage as unknown as { prefix: string }).prefix).toBe("cache/v1/");
    expect((storage as unknown as { ttlMs: number }).ttlMs).toBe(1_800_000);
    storage.close();
  });

  test("uses custom local directory when FFS_CACHE_LOCAL_DIR is set", async () => {
    const customDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ffs-custom-cache-"),
    );

    try {
      process.env.FFS_CACHE_LOCAL_DIR = customDir;

      const storage = createCacheStorage();
      expect(storage).toBeInstanceOf(LocalCacheStorage);
      expect((storage as unknown as { baseDir: string }).baseDir).toBe(
        customDir,
      );

      // Write a file and verify it's in the custom directory
      await storage.put("test-file", Readable.from(Buffer.from("test")));

      const files = await fs.readdir(customDir);
      expect(files).toContain("test-file");

      storage.close();
    } finally {
      await fs.rm(customDir, { recursive: true, force: true });
    }
  });

  test("uses custom TTL from FFS_CACHE_TTL_MS", () => {
    process.env.FFS_CACHE_TTL_MS = "300000"; // 5 minutes

    const storage = createCacheStorage();
    expect(storage).toBeInstanceOf(LocalCacheStorage);
    expect((storage as unknown as { ttlMs: number }).ttlMs).toBe(300_000);
    storage.close();
  });

  test("uses default TTL of 60 minutes when FFS_CACHE_TTL_MS is not set", () => {
    const storage = createCacheStorage();
    expect(storage).toBeInstanceOf(LocalCacheStorage);
    expect((storage as unknown as { ttlMs: number }).ttlMs).toBe(
      60 * 60 * 1000,
    );
    storage.close();
  });
});
