import { describe, test, expect } from "vitest";
import { processTransition } from "./transition";

describe("processTransition", () => {
  describe("fade transitions", () => {
    test("fade with default easing maps to 'fade'", () => {
      expect(processTransition({ type: "fade", duration: 1 })).toBe("fade");
    });

    test("fade with linear easing maps to 'fade'", () => {
      expect(
        processTransition({ type: "fade", duration: 1, easing: "linear" }),
      ).toBe("fade");
    });

    test("fade with ease-in easing maps to 'fadeslow'", () => {
      expect(
        processTransition({ type: "fade", duration: 1, easing: "ease-in" }),
      ).toBe("fadeslow");
    });

    test("fade with ease-out easing maps to 'fadefast'", () => {
      expect(
        processTransition({ type: "fade", duration: 1, easing: "ease-out" }),
      ).toBe("fadefast");
    });

    test("fade through black maps to 'fadeblack'", () => {
      expect(
        processTransition({ type: "fade", duration: 1, through: "black" }),
      ).toBe("fadeblack");
    });

    test("fade through white maps to 'fadewhite'", () => {
      expect(
        processTransition({ type: "fade", duration: 1, through: "white" }),
      ).toBe("fadewhite");
    });

    test("fade through grays maps to 'fadegrays'", () => {
      expect(
        processTransition({ type: "fade", duration: 1, through: "grays" }),
      ).toBe("fadegrays");
    });
  });

  describe("barn door transitions", () => {
    test("barn with defaults maps to 'horzopen'", () => {
      expect(processTransition({ type: "barn", duration: 1 })).toBe("horzopen");
    });

    test("barn horizontal open maps to 'horzopen'", () => {
      expect(
        processTransition({
          type: "barn",
          duration: 1,
          orientation: "horizontal",
          mode: "open",
        }),
      ).toBe("horzopen");
    });

    test("barn horizontal close maps to 'horzclose'", () => {
      expect(
        processTransition({
          type: "barn",
          duration: 1,
          orientation: "horizontal",
          mode: "close",
        }),
      ).toBe("horzclose");
    });

    test("barn vertical open maps to 'vertopen'", () => {
      expect(
        processTransition({
          type: "barn",
          duration: 1,
          orientation: "vertical",
          mode: "open",
        }),
      ).toBe("vertopen");
    });

    test("barn vertical close maps to 'vertclose'", () => {
      expect(
        processTransition({
          type: "barn",
          duration: 1,
          orientation: "vertical",
          mode: "close",
        }),
      ).toBe("vertclose");
    });
  });

  describe("circle transitions", () => {
    test("circle with default mode maps to 'circleopen'", () => {
      expect(processTransition({ type: "circle", duration: 1 })).toBe(
        "circleopen",
      );
    });

    test("circle open maps to 'circleopen'", () => {
      expect(
        processTransition({ type: "circle", duration: 1, mode: "open" }),
      ).toBe("circleopen");
    });

    test("circle close maps to 'circleclose'", () => {
      expect(
        processTransition({ type: "circle", duration: 1, mode: "close" }),
      ).toBe("circleclose");
    });

    test("circle crop maps to 'circlecrop'", () => {
      expect(
        processTransition({ type: "circle", duration: 1, mode: "crop" }),
      ).toBe("circlecrop");
    });
  });

  describe("directional transitions", () => {
    test("wipe with default direction maps to 'wipeleft'", () => {
      expect(processTransition({ type: "wipe", duration: 1 })).toBe("wipeleft");
    });

    test("wipe left maps to 'wipeleft'", () => {
      expect(
        processTransition({ type: "wipe", duration: 1, direction: "left" }),
      ).toBe("wipeleft");
    });

    test("wipe right maps to 'wiperight'", () => {
      expect(
        processTransition({ type: "wipe", duration: 1, direction: "right" }),
      ).toBe("wiperight");
    });

    test("wipe up maps to 'wipeup'", () => {
      expect(
        processTransition({ type: "wipe", duration: 1, direction: "up" }),
      ).toBe("wipeup");
    });

    test("wipe down maps to 'wipedown'", () => {
      expect(
        processTransition({ type: "wipe", duration: 1, direction: "down" }),
      ).toBe("wipedown");
    });

    test("slide left maps to 'slideleft'", () => {
      expect(
        processTransition({ type: "slide", duration: 1, direction: "left" }),
      ).toBe("slideleft");
    });

    test("smooth right maps to 'smoothright'", () => {
      expect(
        processTransition({ type: "smooth", duration: 1, direction: "right" }),
      ).toBe("smoothright");
    });

    test("slice left maps to 'hlslice'", () => {
      expect(
        processTransition({ type: "slice", duration: 1, direction: "left" }),
      ).toBe("hlslice");
    });

    test("slice right maps to 'hrslice'", () => {
      expect(
        processTransition({ type: "slice", duration: 1, direction: "right" }),
      ).toBe("hrslice");
    });

    test("slice up maps to 'vuslice'", () => {
      expect(
        processTransition({ type: "slice", duration: 1, direction: "up" }),
      ).toBe("vuslice");
    });

    test("slice down maps to 'vdslice'", () => {
      expect(
        processTransition({ type: "slice", duration: 1, direction: "down" }),
      ).toBe("vdslice");
    });
  });

  describe("zoom transitions", () => {
    test("zoom maps to 'zoomin'", () => {
      expect(processTransition({ type: "zoom", duration: 1 })).toBe("zoomin");
    });
  });

  describe("standalone transitions", () => {
    test("dissolve maps to 'dissolve'", () => {
      expect(processTransition({ type: "dissolve", duration: 1 })).toBe(
        "dissolve",
      );
    });

    test("pixelize maps to 'pixelize'", () => {
      expect(processTransition({ type: "pixelize", duration: 1 })).toBe(
        "pixelize",
      );
    });

    test("radial maps to 'radial'", () => {
      expect(processTransition({ type: "radial", duration: 1 })).toBe("radial");
    });
  });
});
