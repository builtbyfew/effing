import { describe, expect, test } from "vitest";
import {
  MAX_DIMENSION,
  signFnSegment,
  validateBounds,
  verifyFnSegment,
} from "./segments";

const SECRET = "test-secret";

describe("validateBounds", () => {
  test("accepts valid integer bounds", () => {
    expect(validateBounds({ width: 1080, height: 1920 })).toEqual({
      width: 1080,
      height: 1920,
    });
  });

  test("accepts edges of the allowed range", () => {
    expect(validateBounds({ width: 1, height: 1 })).toEqual({
      width: 1,
      height: 1,
    });
    expect(
      validateBounds({ width: MAX_DIMENSION, height: MAX_DIMENSION }),
    ).toEqual({ width: MAX_DIMENSION, height: MAX_DIMENSION });
  });

  test("rejects missing bounds", () => {
    expect(() => validateBounds(undefined)).toThrow(/missing "bounds"/);
    expect(() => validateBounds(null)).toThrow(/missing "bounds"/);
  });

  test("rejects non-integer values", () => {
    expect(() => validateBounds({ width: 100.5, height: 200 })).toThrow(
      /integers/,
    );
    expect(() => validateBounds({ width: "100", height: 200 })).toThrow(
      /integers/,
    );
  });

  test("rejects zero and negative", () => {
    expect(() => validateBounds({ width: 0, height: 100 })).toThrow(/range/);
    expect(() => validateBounds({ width: -1, height: 100 })).toThrow(/range/);
  });

  test("rejects values above MAX_DIMENSION", () => {
    expect(() =>
      validateBounds({ width: MAX_DIMENSION + 1, height: 100 }),
    ).toThrow(/range/);
  });
});

describe("signFnSegment / verifyFnSegment", () => {
  test("roundtrips id, props, and bounds", async () => {
    const segment = await signFnSegment(
      {
        id: "my-fn",
        props: { foo: "bar", n: 42 },
        bounds: { width: 1080, height: 1080 },
      },
      SECRET,
    );
    const verified = await verifyFnSegment(segment, SECRET);
    expect(verified.id).toBe("my-fn");
    expect(verified.props).toEqual({ foo: "bar", n: 42 });
    expect(verified.bounds).toEqual({ width: 1080, height: 1080 });
  });

  test("rejects tampered segment", async () => {
    const segment = await signFnSegment(
      { id: "x", props: {}, bounds: { width: 100, height: 100 } },
      SECRET,
    );
    const tampered = segment.slice(0, -1) + (segment.endsWith("a") ? "b" : "a");
    await expect(verifyFnSegment(tampered, SECRET)).rejects.toThrow(
      /signature/i,
    );
  });

  test("rejects segment signed with a different secret", async () => {
    const segment = await signFnSegment(
      { id: "x", props: {}, bounds: { width: 100, height: 100 } },
      SECRET,
    );
    await expect(verifyFnSegment(segment, "other-secret")).rejects.toThrow(
      /signature/i,
    );
  });

  test("requireProps=false allows missing props", async () => {
    const segment = await signFnSegment(
      { id: "x", bounds: { width: 100, height: 100 } },
      SECRET,
    );
    const verified = await verifyFnSegment(segment, SECRET, {
      requireProps: false,
    });
    expect(verified.props).toBeUndefined();
  });

  test("default requireProps=true rejects missing props", async () => {
    const segment = await signFnSegment(
      { id: "x", bounds: { width: 100, height: 100 } },
      SECRET,
    );
    await expect(verifyFnSegment(segment, SECRET)).rejects.toThrow(
      /missing "props"/,
    );
  });

  test("rejects out-of-range bounds at verify time", async () => {
    const segment = await signFnSegment(
      {
        id: "x",
        props: {},
        bounds: { width: MAX_DIMENSION + 1, height: 100 },
      },
      SECRET,
    );
    await expect(verifyFnSegment(segment, SECRET)).rejects.toThrow(/range/);
  });

  test("rejects empty id", async () => {
    const segment = await signFnSegment(
      { id: "", props: {}, bounds: { width: 100, height: 100 } },
      SECRET,
    );
    await expect(verifyFnSegment(segment, SECRET)).rejects.toThrow(
      /missing "id"/,
    );
  });
});
