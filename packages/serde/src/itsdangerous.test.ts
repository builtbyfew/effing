import { describe, test, expect } from "vitest";
import {
  deserialize,
  serialize,
  urlsafeBase64Decode,
  urlsafeBase64Encode,
} from "./itsdangerous";

describe("urlsafeBase64", () => {
  test("encode replaces + and / with - and _", () => {
    // 0xfb encodes to +w== in standard base64
    const encoded = urlsafeBase64Encode(Buffer.from([0xfb]));
    expect(encoded).toBe("-w==");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
  });

  test("decode replaces - and _ with + and /", () => {
    const decoded = urlsafeBase64Decode("-_");
    expect(decoded.length).toBe(1);
    expect(decoded[0]).toBe(251);
  });

  test("roundtrip", () => {
    const original = Buffer.from("hello world!");
    const encoded = urlsafeBase64Encode(original);
    const decoded = urlsafeBase64Decode(encoded);
    expect(decoded.toString()).toBe(original.toString());
  });
});

describe("serialize", () => {
  test("short payload is not compressed", async () => {
    const serialized = await serialize({ yolo: "short" }, "testkey");
    expect(serialized.startsWith(".")).toBe(false);
  });

  test("long payload is compressed", async () => {
    const serialized = await serialize(
      {
        yolo: "make this very long so that compression will be triggered yada yada ok this should be long enough now so let's stop",
      },
      "testkey",
    );
    expect(serialized.startsWith(".")).toBe(true);
  });

  test("roundtrip with short value", async () => {
    const original = { yolo: "short", testingHere: 123, another_test: 456 };
    const serialized = await serialize(original, "testkey");
    const deserialized = await deserialize(serialized, "testkey");

    expect(deserialized.yolo).toBe("short");
    expect(deserialized.testingHere).toBe(123);
    // snake_case keys are converted to camelCase
    expect(deserialized.anotherTest).toBe(456);
  });

  test("roundtrip with long value (compressed)", async () => {
    const longValue =
      "make this very long so that compression will be triggered yada yada ok this should be long enough now so let's stop";
    const original = { yolo: longValue, testingHere: 123, another_test: 456 };
    const serialized = await serialize(original, "testkey");
    const deserialized = await deserialize(serialized, "testkey");

    expect(deserialized.yolo).toBe(longValue);
    expect(deserialized.testingHere).toBe(123);
    expect(deserialized.anotherTest).toBe(456);
  });

  test("preserves snake_case keys when convertKeysToCamel is false", async () => {
    const original = { another_test: 456 };
    const serialized = await serialize(original, "testkey");
    const deserialized = await deserialize(serialized, "testkey", {
      convertKeysToCamel: false,
    });

    expect(deserialized.another_test).toBe(456);
    expect(deserialized.anotherTest).toBeUndefined();
  });
});

describe("deserialize", () => {
  test("rejects invalid signature", async () => {
    const serialized = await serialize({ test: 1 }, "testkey");
    await expect(deserialize(serialized, "wrongkey")).rejects.toThrow(
      "invalid url segment signature",
    );
  });

  test("deserializes uncompressed segment from itsdangerous", async () => {
    const segment =
      "eyJwcm9jZXNzb3JfaWQiOiJvZmktcGlsbHMiLCJpbWFnZV91cmxzIjpbImh0dHA6Ly9pbWFnZS5jb20vb25lLnBuZyJdfQ.Je3-o-UbfCSHQ7KN34cmF4TY_fg";

    await expect(deserialize(segment, "wrongkey")).rejects.toThrow();

    const deserialized = await deserialize(segment, "testkey");
    expect(deserialized.processorId).toBe("ofi-pills");
    expect(deserialized.imageUrls).toHaveLength(1);
  });

  test("deserializes compressed segment from itsdangerous", async () => {
    const segment =
      ".eJx1i0EOgCAMBP_Ss8KdrxhjDII2AdsU0IPx7xI9Go67M3MBC1mXEsmECxggjz1jCAk6wDivbipShxlgy5mN1u-pLEVNu1O8r1X8oXxSE23imp2nIk2Gx9eN9wOnxz8Q.5BALVFcZR5GmrWjjWI3G_klAmws";

    await expect(deserialize(segment, "wrongkey")).rejects.toThrow();

    const deserialized = await deserialize(segment, "testkey");
    expect(deserialized.processorId).toBe("ofi-pills");
    expect((deserialized.imageUrls as string[]).length).toBeGreaterThan(0);
  });

  test("deserializes segment compressed with node 22 zip", async () => {
    const segment =
      ".H4sIAAAAAAAAEyXMQQ6EIBBE0atU2MwdvA0OHSC2lKHbMWTi3Y26-auf9w-DyjCFNS4CL9Xwkz6gbBlGeImOL9eti1llw1FVMQu815ylS8KIKb7h8gpWuGu6r4eRxj0XNB63qOIfgzm3cF6mmWiHfgAAAA==._kg_iWmj_Ku4RX9DCb1V74qw-j0=";

    const deserialized = await deserialize(segment, "testkey");
    expect(deserialized).toStrictEqual({
      yolo: "make this very long so that compression will be triggered yada yada ok this should be long enough now so let's stop",
    });
  });
});
