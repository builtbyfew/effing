import { GlobalFonts } from "@effing/skia";
import { describe, expect, it, vi } from "vitest";

describe("fontGeneration", () => {
  it("counts each change to GlobalFonts once, however many copies of font.ts there are", async () => {
    const first = await import("./font.ts");
    const register = GlobalFonts.register;
    vi.resetModules();
    const second = await import("./font.ts");
    expect(second).not.toBe(first);
    // The second copy found the first one's wrappers rather than adding its
    // own around them.
    expect(GlobalFonts.register).toBe(register);
    expect(GlobalFonts.register.name).toBe("register");

    const before = first.fontGeneration();
    expect(second.fontGeneration()).toBe(before);
    GlobalFonts.setAlias("No Such Font", "Still No Such Font");
    expect(first.fontGeneration()).toBe(before + 1);
    expect(second.fontGeneration()).toBe(before + 1);
  });
});
