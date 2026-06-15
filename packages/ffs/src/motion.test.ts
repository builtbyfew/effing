import { describe, test, expect } from "vitest";
import { processMotion } from "./motion";

describe("processMotion", () => {
  test("without motion, returns static origin", () => {
    expect(processMotion(0)).toBe("x=0:y=0");
  });

  // The overlay filter snaps x/y down to even values for yuv420p chroma
  // alignment. Unrounded float positions that sit exactly on that boundary
  // (e.g. 719.9999999 vs 720) flip individual frames 2px across it, which
  // shows up as per-frame edge jitter on slides. Rounding the final
  // expressions keeps epsilon noise from changing the snapped result.
  test.each(["slide", "bounce", "shake"] as const)(
    "%s coordinates are rounded to whole pixels",
    (type) => {
      const result = processMotion(
        0,
        type === "slide" ? { type, direction: "left" } : { type },
      );
      expect(result).toMatch(/^x='round\(.*\)':y='round\(.*\)'$/);
    },
  );

  test("rounding wraps the entire piecewise expression", () => {
    const result = processMotion(2, {
      type: "slide",
      direction: "left",
      start: 0,
      duration: 1.5,
    });
    expect(result).toBe(
      "x='round(if(lt(t,2),1*W,if(lt(t,3.5),(1*W)*(1-((((t-2))/1.5))),0)))'" +
        ":y='round(if(lt(t,2),0,if(lt(t,3.5),0,0)))'",
    );
  });
});
