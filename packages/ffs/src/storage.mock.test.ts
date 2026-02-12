import { describe, test, expect, vi, beforeEach } from "vitest";
import { Readable } from "stream";

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: vi.fn(),
}));

describe("S3TransientStore", () => {
  let mockS3Send: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset module cache to get fresh mocks
    vi.resetModules();

    // Setup S3Client mock
    const { S3Client } = await import("@aws-sdk/client-s3");
    mockS3Send = vi.fn();
    vi.mocked(S3Client).mockImplementation(
      () =>
        ({
          send: mockS3Send,
        }) as unknown as InstanceType<typeof S3Client>,
    );
  });

  describe("constructor", () => {
    test("creates S3Client with endpoint and credentials", async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      new S3TransientStore({
        endpoint: "https://s3.example.com",
        region: "us-east-1",
        bucket: "my-bucket",
        prefix: "cache/",
        accessKeyId: "access-key",
        secretAccessKey: "secret-key",
        ttlMs: 3600000,
      });

      expect(S3Client).toHaveBeenCalledWith({
        endpoint: "https://s3.example.com",
        region: "us-east-1",
        credentials: {
          accessKeyId: "access-key",
          secretAccessKey: "secret-key",
        },
        forcePathStyle: true,
      });
    });

    test("creates S3Client without credentials when not provided", async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      new S3TransientStore({
        bucket: "my-bucket",
      });

      expect(S3Client).toHaveBeenCalledWith({
        endpoint: undefined,
        region: "auto",
        credentials: undefined,
        forcePathStyle: false,
      });
    });
  });

  describe("put", () => {
    test("uses Upload with correct parameters", async () => {
      const { Upload } = await import("@aws-sdk/lib-storage");
      const { S3TransientStore } = await import("./storage");

      const mockUpload = {
        done: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(Upload).mockImplementation(
        () => mockUpload as unknown as InstanceType<typeof Upload>,
      );

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        prefix: "cache/",
      });

      const stream = Readable.from(Buffer.from("test data"));
      await storage.put("test-key", stream);

      expect(Upload).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            Bucket: "my-bucket",
            Key: "cache/test-key",
            Body: stream,
            Expires: expect.any(Date),
          }),
        }),
      );
      expect(mockUpload.done).toHaveBeenCalled();
    });
  });

  describe("getStream", () => {
    test("returns stream when object exists", async () => {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      const mockBody = Readable.from(Buffer.from("cached data"));
      mockS3Send.mockResolvedValueOnce({ Body: mockBody });

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        prefix: "cache/",
      });

      const result = await storage.getStream("test-key");

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: "my-bucket",
        Key: "cache/test-key",
      });
      expect(result).toBe(mockBody);
    });

    test("returns null when object does not exist (NoSuchKey)", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce({ name: "NoSuchKey" });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.getStream("missing-key");

      expect(result).toBeNull();
    });

    test("returns null when object does not exist (404 status)", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.getStream("missing-key");

      expect(result).toBeNull();
    });

    test("throws on other errors", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce(new Error("Network error"));

      const storage = new S3TransientStore({ bucket: "my-bucket" });

      await expect(storage.getStream("test-key")).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("exists", () => {
    test("returns true when object exists", async () => {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValueOnce({});

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        prefix: "cache/",
      });

      const result = await storage.exists("test-key");

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: "my-bucket",
        Key: "cache/test-key",
      });
      expect(result).toBe(true);
    });

    test("returns false when object does not exist (NotFound)", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce({ name: "NotFound" });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.exists("missing-key");

      expect(result).toBe(false);
    });

    test("returns false when object does not exist (404 status)", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.exists("missing-key");

      expect(result).toBe(false);
    });

    test("throws on other errors", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce(new Error("Access denied"));

      const storage = new S3TransientStore({ bucket: "my-bucket" });

      await expect(storage.exists("test-key")).rejects.toThrow("Access denied");
    });
  });

  describe("existsMany", () => {
    test("returns map of existence checks", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send
        .mockResolvedValueOnce({}) // key1 exists
        .mockRejectedValueOnce({ name: "NotFound" }) // key2 missing
        .mockResolvedValueOnce({}); // key3 exists

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.existsMany(["key1", "key2", "key3"]);

      expect(result.get("key1")).toBe(true);
      expect(result.get("key2")).toBe(false);
      expect(result.get("key3")).toBe(true);
    });
  });

  describe("delete", () => {
    test("deletes object with correct key", async () => {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValueOnce({});

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        prefix: "cache/",
      });

      await storage.delete("test-key");

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: "my-bucket",
        Key: "cache/test-key",
      });
    });

    test("ignores NoSuchKey error", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce({ name: "NoSuchKey" });

      const storage = new S3TransientStore({ bucket: "my-bucket" });

      await expect(storage.delete("missing-key")).resolves.toBeUndefined();
    });

    test("throws on other errors", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce(new Error("Access denied"));

      const storage = new S3TransientStore({ bucket: "my-bucket" });

      await expect(storage.delete("test-key")).rejects.toThrow("Access denied");
    });
  });

  describe("putJson", () => {
    test("stores JSON with correct content type", async () => {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValueOnce({});

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        prefix: "cache/",
      });

      await storage.putJson("metadata.json", { foo: "bar", count: 42 });

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: "my-bucket",
        Key: "cache/metadata.json",
        Body: JSON.stringify({ foo: "bar", count: 42 }),
        ContentType: "application/json",
        Expires: expect.any(Date),
      });
    });
  });

  describe("getJson", () => {
    test("returns parsed JSON when object exists", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValueOnce({
        Body: {
          transformToString: vi
            .fn()
            .mockResolvedValue('{"foo":"bar","count":42}'),
        },
      });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.getJson<{ foo: string; count: number }>(
        "metadata.json",
      );

      expect(result).toEqual({ foo: "bar", count: 42 });
    });

    test("returns null when object does not exist", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockRejectedValueOnce({ name: "NoSuchKey" });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.getJson("missing.json");

      expect(result).toBeNull();
    });

    test("returns null when body is empty", async () => {
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValueOnce({
        Body: {
          transformToString: vi.fn().mockResolvedValue(""),
        },
      });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const result = await storage.getJson("empty.json");

      expect(result).toBeNull();
    });
  });

  describe("TTL configuration", () => {
    test("uses default TTL of 60 minutes for put()", async () => {
      const { Upload } = await import("@aws-sdk/lib-storage");
      const { S3TransientStore } = await import("./storage");

      const mockUpload = { done: vi.fn().mockResolvedValue({}) };
      vi.mocked(Upload).mockImplementation(
        () => mockUpload as unknown as InstanceType<typeof Upload>,
      );

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      const stream = Readable.from(Buffer.from("test"));

      const beforeTime = Date.now();
      await storage.put("test-key", stream);
      const afterTime = Date.now();

      const callParams = vi.mocked(Upload).mock.calls[0][0] as {
        params: { Expires: Date };
      };
      const expiresTime = callParams.params.Expires.getTime();

      // Should be approximately 60 minutes in the future (default TTL)
      expect(expiresTime).toBeGreaterThanOrEqual(beforeTime + 60 * 60 * 1000);
      expect(expiresTime).toBeLessThanOrEqual(afterTime + 60 * 60 * 1000);
    });

    test("uses default TTL of 60 minutes for putJson()", async () => {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValueOnce({});

      const storage = new S3TransientStore({ bucket: "my-bucket" });

      const beforeTime = Date.now();
      await storage.putJson("job.json", { test: true });
      const afterTime = Date.now();

      const callParams = vi.mocked(PutObjectCommand).mock.calls[0][0] as {
        Expires: Date;
      };
      const expiresTime = callParams.Expires.getTime();

      // Should be approximately 60 minutes in the future (default TTL)
      expect(expiresTime).toBeGreaterThanOrEqual(beforeTime + 60 * 60 * 1000);
      expect(expiresTime).toBeLessThanOrEqual(afterTime + 60 * 60 * 1000);
    });

    test("uses custom TTL when provided", async () => {
      const { Upload } = await import("@aws-sdk/lib-storage");
      const { S3TransientStore } = await import("./storage");

      const mockUpload = { done: vi.fn().mockResolvedValue({}) };
      vi.mocked(Upload).mockImplementation(
        () => mockUpload as unknown as InstanceType<typeof Upload>,
      );

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        ttlMs: 30 * 60 * 1000, // 30 minutes
      });
      const stream = Readable.from(Buffer.from("test"));

      const beforeTime = Date.now();
      await storage.put("test-key", stream);
      const afterTime = Date.now();

      const callParams = vi.mocked(Upload).mock.calls[0][0] as {
        params: { Expires: Date };
      };
      const expiresTime = callParams.params.Expires.getTime();

      // Should be approximately 30 minutes in the future
      expect(expiresTime).toBeGreaterThanOrEqual(beforeTime + 30 * 60 * 1000);
      expect(expiresTime).toBeLessThanOrEqual(afterTime + 30 * 60 * 1000);
    });

    test("allows overriding TTL per operation", async () => {
      const { Upload } = await import("@aws-sdk/lib-storage");
      const { S3TransientStore } = await import("./storage");

      const mockUpload = { done: vi.fn().mockResolvedValue({}) };
      vi.mocked(Upload).mockImplementation(
        () => mockUpload as unknown as InstanceType<typeof Upload>,
      );

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        ttlMs: 60 * 60 * 1000, // 60 minutes default
      });
      const stream = Readable.from(Buffer.from("test"));

      const beforeTime = Date.now();
      // Override with 15 minute TTL
      await storage.put("test-key", stream, 15 * 60 * 1000);
      const afterTime = Date.now();

      const callParams = vi.mocked(Upload).mock.calls[0][0] as {
        params: { Expires: Date };
      };
      const expiresTime = callParams.params.Expires.getTime();

      // Should be approximately 15 minutes in the future (override)
      expect(expiresTime).toBeGreaterThanOrEqual(beforeTime + 15 * 60 * 1000);
      expect(expiresTime).toBeLessThanOrEqual(afterTime + 15 * 60 * 1000);
    });

    test("exposes TTL value as public property", async () => {
      const { S3TransientStore } = await import("./storage");

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        ttlMs: 30 * 60 * 1000,
      });

      expect(storage.ttlMs).toBe(30 * 60 * 1000);
    });
  });

  describe("prefix handling", () => {
    test("prepends prefix to all keys", async () => {
      const {
        GetObjectCommand,
        HeadObjectCommand,
        DeleteObjectCommand,
        PutObjectCommand,
      } = await import("@aws-sdk/client-s3");
      const { Upload } = await import("@aws-sdk/lib-storage");
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValue({
        Body: { transformToString: vi.fn().mockResolvedValue("{}") },
      });

      const mockUpload = { done: vi.fn().mockResolvedValue({}) };
      vi.mocked(Upload).mockImplementation(
        () => mockUpload as unknown as InstanceType<typeof Upload>,
      );

      const storage = new S3TransientStore({
        bucket: "my-bucket",
        prefix: "v1/cache/",
      });

      // Test all operations
      await storage.put("file.bin", Readable.from(Buffer.from("data")));
      await storage.getStream("file.bin");
      await storage.exists("file.bin");
      await storage.delete("file.bin");
      await storage.putJson("meta.json", {});
      await storage.getJson("meta.json");

      // Verify all used the prefix
      expect(vi.mocked(Upload).mock.calls[0][0]).toMatchObject({
        params: { Key: "v1/cache/file.bin" },
      });
      expect(GetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: "v1/cache/file.bin" }),
      );
      expect(HeadObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: "v1/cache/file.bin" }),
      );
      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: "v1/cache/file.bin" }),
      );
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: "v1/cache/meta.json" }),
      );
      // getJson uses GetObjectCommand which was already called
    });

    test("works without prefix", async () => {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { S3TransientStore } = await import("./storage");

      mockS3Send.mockResolvedValueOnce({
        Body: Readable.from(Buffer.from("data")),
      });

      const storage = new S3TransientStore({ bucket: "my-bucket" });
      await storage.getStream("file.bin");

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: "my-bucket",
        Key: "file.bin",
      });
    });
  });

  describe("close", () => {
    test("does nothing (S3 cleanup handled by lifecycle rules)", async () => {
      const { S3TransientStore } = await import("./storage");

      const storage = new S3TransientStore({ bucket: "my-bucket" });

      // Should not throw
      expect(() => storage.close()).not.toThrow();
    });
  });
});
