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

  describe("scale factor", () => {
    test("shake intensity is in full-size pixels, scaled with the render", () => {
      const shake = { type: "shake", intensity: 8, frequency: 2 } as const;
      expect(processMotion(1, shake)).toBe(
        "x='round(if(lt(t,1),0,if(lt(t,2),8*sin((t-1)*PI*2),0)))'" +
          ":y='round(if(lt(t,1),0,if(lt(t,2),8*cos((t-1)*PI*2),0)))'",
      );
      expect(processMotion(1, shake, 0.5)).toBe(
        "x='round(if(lt(t,1),0,if(lt(t,2),4*sin((t-1)*PI*2),0)))'" +
          ":y='round(if(lt(t,1),0,if(lt(t,2),4*cos((t-1)*PI*2),0)))'",
      );
    });

    test("default shake intensity of 10 px is scaled too", () => {
      expect(processMotion(0, { type: "shake" }, 0.25)).toBe(
        "x='round(if(lt(t,0),0,if(lt(t,1),2.5*sin((t-0)*PI*4),0)))'" +
          ":y='round(if(lt(t,0),0,if(lt(t,1),2.5*cos((t-0)*PI*4),0)))'",
      );
    });

    test("scale 1 is the default", () => {
      const shake = { type: "shake", intensity: 7 } as const;
      expect(processMotion(0.5, shake, 1)).toBe(processMotion(0.5, shake));
    });

    // Slide offsets are fractions of the frame (W, H) and bounce offsets of
    // the layer's height (overlay_h), both of which a scaled render shrinks.
    test.each([
      { type: "slide", direction: "left", distance: 0.3 },
      { type: "slide", direction: "down", reverse: true, easing: "ease-in" },
      { type: "bounce", amplitude: 0.8 },
    ] as const)("$type motion is relative, so unchanged by scale", (motion) => {
      expect(processMotion(0, motion, 0.5)).toBe(processMotion(0, motion));
    });
  });
});
