import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import {
  LocalTransientStore,
  createTransientStore,
  S3TransientStore,
} from "./storage";
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

describe("LocalTransientStore", () => {
  let tempDir: string;
  let storage: LocalTransientStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ffs-transient-store-test-"),
    );
    storage = new LocalTransientStore({ baseDir: tempDir });
  });

  afterEach(async () => {
    storage.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("put and getStream", () => {
    test("stores and retrieves stream data", async () => {
      const data = Buffer.from("test transient data");
      const stream = Readable.from(data);

      await storage.put("test-file", stream);

      const retrieved = await storage.getStream("test-file");
      expect(retrieved).not.toBeNull();

      const result = await readAll(retrieved!);
      expect(result.toString()).toBe("test transient data");
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
      const testStorage = new LocalTransientStore({ baseDir: tempDir });

      // Should not throw
      testStorage.close();

      // Calling close again should also be safe
      testStorage.close();
    });
  });

  describe("TTL properties", () => {
    test("exposes default TTL values", () => {
      expect(storage.sourceTtlMs).toBe(60 * 60 * 1000);
      expect(storage.jobDataTtlMs).toBe(8 * 60 * 60 * 1000);
    });

    test("uses custom TTL values when provided", () => {
      const customStorage = new LocalTransientStore({
        baseDir: tempDir,
        sourceTtlMs: 30 * 60 * 1000,
        jobDataTtlMs: 2 * 60 * 60 * 1000,
      });

      expect(customStorage.sourceTtlMs).toBe(30 * 60 * 1000);
      expect(customStorage.jobDataTtlMs).toBe(2 * 60 * 60 * 1000);

      customStorage.close();
    });
  });
});

describe("LocalTransientStore TTL cleanup", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ffs-transient-ttl-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("cleans up files older than TTL", async () => {
    // Create storage with very short TTL (1ms for both)
    const storage = new LocalTransientStore({
      baseDir: tempDir,
      sourceTtlMs: 1,
      jobDataTtlMs: 1,
    });

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

describe("createTransientStore", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset relevant env vars
    delete process.env.FFS_TRANSIENT_STORE_BUCKET;
    delete process.env.FFS_TRANSIENT_STORE_ENDPOINT;
    delete process.env.FFS_TRANSIENT_STORE_REGION;
    delete process.env.FFS_TRANSIENT_STORE_PREFIX;
    delete process.env.FFS_TRANSIENT_STORE_ACCESS_KEY;
    delete process.env.FFS_TRANSIENT_STORE_SECRET_KEY;
    delete process.env.FFS_TRANSIENT_STORE_LOCAL_DIR;
    delete process.env.FFS_SOURCE_CACHE_TTL_MS;
    delete process.env.FFS_JOB_DATA_TTL_MS;
  });

  afterAll(() => {
    // Restore original env without reassigning `process.env` (Node treats it specially).
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  test("returns LocalTransientStore when FFS_TRANSIENT_STORE_BUCKET is not set", () => {
    const storage = createTransientStore();

    expect(storage).toBeInstanceOf(LocalTransientStore);
    storage.close();
  });

  test("returns S3TransientStore when FFS_TRANSIENT_STORE_BUCKET is set", () => {
    process.env.FFS_TRANSIENT_STORE_BUCKET = "my-bucket";

    const storage = createTransientStore();

    expect(storage).toBeInstanceOf(S3TransientStore);
    expect((storage as unknown as { bucket: string }).bucket).toBe("my-bucket");
    storage.close();
  });

  test("passes S3 configuration from environment", () => {
    process.env.FFS_TRANSIENT_STORE_BUCKET = "my-bucket";
    process.env.FFS_TRANSIENT_STORE_ENDPOINT = "https://s3.example.com";
    process.env.FFS_TRANSIENT_STORE_REGION = "us-west-2";
    process.env.FFS_TRANSIENT_STORE_PREFIX = "transient/v1/";
    process.env.FFS_TRANSIENT_STORE_ACCESS_KEY = "access-key";
    process.env.FFS_TRANSIENT_STORE_SECRET_KEY = "secret-key";
    process.env.FFS_SOURCE_CACHE_TTL_MS = "1800000";
    process.env.FFS_JOB_DATA_TTL_MS = "7200000";

    const storage = createTransientStore();

    // Can't easily verify S3 client config, but we can verify it's an S3 storage
    expect(storage).toBeInstanceOf(S3TransientStore);
    expect((storage as unknown as { bucket: string }).bucket).toBe("my-bucket");
    expect((storage as unknown as { prefix: string }).prefix).toBe(
      "transient/v1/",
    );
    expect(storage.sourceTtlMs).toBe(1_800_000);
    expect(storage.jobDataTtlMs).toBe(7_200_000);
    storage.close();
  });

  test("uses custom local directory when FFS_TRANSIENT_STORE_LOCAL_DIR is set", async () => {
    const customDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ffs-custom-transient-"),
    );

    try {
      process.env.FFS_TRANSIENT_STORE_LOCAL_DIR = customDir;

      const storage = createTransientStore();
      expect(storage).toBeInstanceOf(LocalTransientStore);
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

  test("uses custom source TTL from FFS_SOURCE_CACHE_TTL_MS", () => {
    process.env.FFS_SOURCE_CACHE_TTL_MS = "300000"; // 5 minutes

    const storage = createTransientStore();
    expect(storage).toBeInstanceOf(LocalTransientStore);
    expect(storage.sourceTtlMs).toBe(300_000);
    storage.close();
  });

  test("uses custom job data TTL from FFS_JOB_DATA_TTL_MS", () => {
    process.env.FFS_JOB_DATA_TTL_MS = "14400000"; // 4 hours

    const storage = createTransientStore();
    expect(storage).toBeInstanceOf(LocalTransientStore);
    expect(storage.jobDataTtlMs).toBe(14_400_000);
    storage.close();
  });

  test("uses default TTLs when env vars are not set", () => {
    const storage = createTransientStore();
    expect(storage).toBeInstanceOf(LocalTransientStore);
    expect(storage.sourceTtlMs).toBe(60 * 60 * 1000); // 60 minutes
    expect(storage.jobDataTtlMs).toBe(8 * 60 * 60 * 1000); // 8 hours
    storage.close();
  });
});
