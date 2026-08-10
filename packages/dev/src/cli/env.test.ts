import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSecretKey } from "./env";

describe("ensureSecretKey", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.SECRET_KEY;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.SECRET_KEY;
    else process.env.SECRET_KEY = saved;
  });

  it("keeps a configured key", () => {
    process.env.SECRET_KEY = "configured";
    expect(ensureSecretKey()).toEqual({
      secretKey: "configured",
      generated: false,
    });
    expect(process.env.SECRET_KEY).toBe("configured");
  });

  it("generates a throwaway key when unset", () => {
    delete process.env.SECRET_KEY;
    const { secretKey, generated } = ensureSecretKey();
    expect(generated).toBe(true);
    expect(secretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(process.env.SECRET_KEY).toBe(secretKey);
  });
});
