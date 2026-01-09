import type { EffieTransition } from "@effing/effie";

export function processTransition(transition: EffieTransition): string {
  switch (transition.type) {
    case "fade": {
      if ("through" in transition) {
        // Fade through color: fadeblack, fadewhite, fadegrays
        return `fade${transition.through}`;
      }
      // Crossfade with easing
      const easing = transition.easing ?? "linear";
      return {
        linear: "fade",
        "ease-in": "fadeslow",
        "ease-out": "fadefast",
      }[easing];
    }
    case "barn": {
      // Barn door wipes: vertopen, vertclose, horzopen, horzclose
      const orientation = transition.orientation ?? "horizontal";
      const mode = transition.mode ?? "open";
      const prefix = orientation === "vertical" ? "vert" : "horz";
      return `${prefix}${mode}`;
    }
    case "circle": {
      // Circle wipes: circleopen, circleclose, circlecrop
      const mode = transition.mode ?? "open";
      return `circle${mode}`;
    }
    case "wipe":
    case "slide":
    case "smooth": {
      const direction = transition.direction ?? "left";
      return `${transition.type}${direction}`;
    }
    case "slice": {
      const direction = transition.direction ?? "left";
      const prefix = {
        left: "hl",
        right: "hr",
        up: "vu",
        down: "vd",
      }[direction];
      return `${prefix}${transition.type}`;
    }
    case "zoom": {
      return "zoomin";
    }
    case "dissolve":
    case "pixelize":
    case "radial":
      return transition.type;
    default:
      transition satisfies never;
      throw new Error(
        `Unsupported transition type: ${(transition as EffieTransition).type}`,
      );
  }
}
