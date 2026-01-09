import type { EffieMotion } from "@effing/effie";

/**
 * Defines the building blocks for an FFmpeg motion expression.
 */
type MotionComponents = {
  initialX: string; // Expression for X before animation starts
  initialY: string; // Expression for Y before animation starts
  activeX: string; // Expression for X during animation (incorporates relative time)
  activeY: string; // Expression for Y during animation (incorporates relative time)
  finalX: string; // Expression for X after animation ends
  finalY: string; // Expression for Y after animation ends
  duration: number; // Duration of the animation effect itself
};

function getEasingExpression(
  tNormExpr: string,
  easingType: "linear" | "ease-in" | "ease-out" | "ease-in-out",
): string {
  switch (easingType) {
    case "ease-in":
      // t^2
      return `pow(${tNormExpr},2)`;
    case "ease-out":
      // 1 - (1-t)^2
      return `(1-pow(1-(${tNormExpr}),2))`;
    case "ease-in-out":
      // t < 0.5 ? 2*t^2 : 1 - (-2*t + 2)^2 / 2
      return `if(lt(${tNormExpr},0.5),2*pow(${tNormExpr},2),1-pow(-2*(${tNormExpr})+2,2)/2)`;
    case "linear":
    default:
      // Default to linear if type is unknown or "linear"
      return `(${tNormExpr})`; // Ensure parentheses for safety if tNormExpr is complex
  }
}

function processSlideMotion(
  motion: Extract<EffieMotion, { type: "slide" }>,
  relativeTimeExpr: string,
): MotionComponents {
  const duration = motion.duration ?? 1;
  const distance = motion.distance ?? 1;
  const reverse = motion.reverse ?? false;
  const easing = motion.easing ?? "linear"; // Default to linear easing

  // 1. Calculate normalized time (0 to 1 over the duration)
  // Assuming duration > 0
  const tNormExpr = `(${relativeTimeExpr})/${duration}`;

  // 2. Get the easing function expression applied to normalized time
  const easedProgressExpr = getEasingExpression(tNormExpr, easing);

  // 3. Determine the final time factor based on easing and direction (reverse)
  //    - If reverse (slide out): Progress goes 0 -> 1 (eased)
  //    - If not reverse (slide in): Progress goes 1 -> 0 (eased, so 1 - eased_progress)
  const finalTimeFactorExpr = reverse
    ? easedProgressExpr
    : `(1-(${easedProgressExpr}))`; // Parentheses around easedProgressExpr are crucial

  let activeX: string;
  let activeY: string;
  let initialX: string;
  let initialY: string;
  let finalX: string;
  let finalY: string;

  switch (motion.direction) {
    case "left": {
      const offsetXLeft = `${distance}*W`;
      activeX = `(${offsetXLeft})*${finalTimeFactorExpr}`;
      activeY = "0";
      initialX = reverse ? "0" : offsetXLeft;
      initialY = "0";
      finalX = reverse ? offsetXLeft : "0";
      finalY = "0";
      break;
    }
    case "right": {
      const offsetXRight = `-${distance}*W`;
      activeX = `(${offsetXRight})*${finalTimeFactorExpr}`;
      activeY = "0";
      initialX = reverse ? "0" : offsetXRight;
      initialY = "0";
      finalX = reverse ? offsetXRight : "0";
      finalY = "0";
      break;
    }
    case "up": {
      const offsetYUp = `${distance}*H`;
      activeX = "0";
      activeY = `(${offsetYUp})*${finalTimeFactorExpr}`;
      initialX = "0";
      initialY = reverse ? "0" : offsetYUp;
      finalX = "0";
      finalY = reverse ? offsetYUp : "0";
      break;
    }
    case "down": {
      const offsetYDown = `-${distance}*H`;
      activeX = "0";
      activeY = `(${offsetYDown})*${finalTimeFactorExpr}`;
      initialX = "0";
      initialY = reverse ? "0" : offsetYDown;
      finalX = "0";
      finalY = reverse ? offsetYDown : "0";
      break;
    }
  }

  return { initialX, initialY, activeX, activeY, finalX, finalY, duration };
}

function processBounceMotion(
  motion: Extract<EffieMotion, { type: "bounce" }>,
  relativeTimeExpr: string,
): MotionComponents {
  const amplitude = motion.amplitude ?? 0.5;
  const duration = motion.duration ?? 1;
  const initialY = `-overlay_h*${amplitude}`;
  const finalY = "0";

  // Calculate the normalized time expression (ranging from 0 to 1 over the duration)
  // Note: Assumes duration > 0. FFmpeg might handle division by zero, but it's safer to ensure duration > 0.
  const tNormExpr = `(${relativeTimeExpr})/${duration}`;

  // Piecewise parabolic approximation using normalized time (tNormExpr)
  const activeBounceExpression =
    `if(lt(${tNormExpr},0.363636),${initialY}+overlay_h*${amplitude}*(7.5625*${tNormExpr}*${tNormExpr}),` +
    `if(lt(${tNormExpr},0.727273),${initialY}+overlay_h*${amplitude}*(7.5625*(${tNormExpr}-0.545455)*(${tNormExpr}-0.545455)+0.75),` +
    `if(lt(${tNormExpr},0.909091),${initialY}+overlay_h*${amplitude}*(7.5625*(${tNormExpr}-0.818182)*(${tNormExpr}-0.818182)+0.9375),` +
    `if(lt(${tNormExpr},0.954545),${initialY}+overlay_h*${amplitude}*(7.5625*(${tNormExpr}-0.954545)*(${tNormExpr}-0.954545)+0.984375),` +
    `${finalY}` + // Should settle to finalY as tNormExpr approaches 1
    `))))`;

  return {
    initialX: "0",
    initialY: initialY,
    activeX: "0",
    activeY: activeBounceExpression, // This expression now scales with duration
    finalX: "0",
    finalY: finalY,
    duration: duration, // Return the actual duration used
  };
}

function processShakeMotion(
  motion: Extract<EffieMotion, { type: "shake" }>,
  relativeTimeExpr: string,
): MotionComponents {
  const intensity = motion.intensity ?? 10;
  const frequency = motion.frequency ?? 4;
  const duration = motion.duration ?? 1;

  const activeX = `${intensity}*sin(${relativeTimeExpr}*PI*${frequency})`;
  const activeY = `${intensity}*cos(${relativeTimeExpr}*PI*${frequency})`;

  return {
    initialX: "0",
    initialY: "0",
    activeX: activeX,
    activeY: activeY,
    finalX: "0",
    finalY: "0",
    duration: duration,
  };
}

export function processMotion(delay: number, motion?: EffieMotion): string {
  if (!motion) return "x=0:y=0";

  const start = delay + (motion.start ?? 0);
  const relativeTimeExpr = `(t-${start})`;
  let components: MotionComponents;

  switch (motion.type) {
    case "bounce":
      components = processBounceMotion(motion, relativeTimeExpr);
      break;
    case "shake":
      components = processShakeMotion(motion, relativeTimeExpr);
      break;
    case "slide":
      components = processSlideMotion(motion, relativeTimeExpr);
      break;
    default:
      motion satisfies never;
      throw new Error(
        `Unsupported motion type: ${(motion as EffieMotion).type}`,
      );
  }

  const motionEndTime = start + components.duration;

  const xArg = `if(lt(t,${start}),${components.initialX},if(lt(t,${motionEndTime}),${components.activeX},${components.finalX}))`;
  const yArg = `if(lt(t,${start}),${components.initialY},if(lt(t,${motionEndTime}),${components.activeY},${components.finalY}))`;

  return `x='${xArg}':y='${yArg}'`;
}
