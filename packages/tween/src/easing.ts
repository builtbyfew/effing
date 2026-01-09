// ============================================
// Easing functions
// See: https://easings.net/
// ============================================

/** Linear interpolation (no easing) */
export function linear(x: number): number {
  return x;
}

// Sine

/** Ease in using sine curve */
export function easeInSine(x: number): number {
  return 1 - Math.cos((x * Math.PI) / 2);
}

/** Ease out using sine curve */
export function easeOutSine(x: number): number {
  return Math.sin((x * Math.PI) / 2);
}

/** Ease in-out using sine curve */
export function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

// Quad

/** Ease in using quadratic curve */
export function easeInQuad(x: number): number {
  return x * x;
}

/** Ease out using quadratic curve */
export function easeOutQuad(x: number): number {
  return 1 - Math.pow(1 - x, 2);
}

/** Ease in-out using quadratic curve */
export function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// Cubic

/** Ease in using cubic curve */
export function easeInCubic(x: number): number {
  return x * x * x;
}

/** Ease out using cubic curve */
export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/** Ease in-out using cubic curve */
export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Quart

/** Ease in using quartic curve */
export function easeInQuart(x: number): number {
  return x * x * x * x;
}

/** Ease out using quartic curve */
export function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

/** Ease in-out using quartic curve */
export function easeInOutQuart(x: number): number {
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

// Quint

/** Ease in using quintic curve */
export function easeInQuint(x: number): number {
  return x * x * x * x * x;
}

/** Ease out using quintic curve */
export function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5);
}

/** Ease in-out using quintic curve */
export function easeInOutQuint(x: number): number {
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

// Expo

/** Ease in using exponential curve */
export function easeInExpo(x: number): number {
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
}

/** Ease out using exponential curve */
export function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/** Ease in-out using exponential curve */
export function easeInOutExpo(x: number): number {
  return x === 0
    ? 0
    : x === 1
      ? 1
      : x < 0.5
        ? Math.pow(2, 20 * x - 10) / 2
        : (2 - Math.pow(2, -20 * x + 10)) / 2;
}

// Circ

/** Ease in using circular curve */
export function easeInCirc(x: number): number {
  return 1 - Math.sqrt(1 - Math.pow(x, 2));
}

/** Ease out using circular curve */
export function easeOutCirc(x: number): number {
  return Math.sqrt(1 - Math.pow(x - 1, 2));
}

/** Ease in-out using circular curve */
export function easeInOutCirc(x: number): number {
  return x < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
}

// Back

/** Ease in with overshoot (back) */
export function easeInBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * x * x * x - c1 * x * x;
}

/** Ease out with overshoot (back) */
export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Ease in-out with overshoot (back) */
export function easeInOutBack(x: number): number {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;

  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

// Elastic

/** Ease in with elastic bounce */
export function easeInElastic(x: number): number {
  const c4 = (2 * Math.PI) / 3;
  return x === 0
    ? 0
    : x === 1
      ? 1
      : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4);
}

/** Ease out with elastic bounce */
export function easeOutElastic(x: number): number {
  const c4 = (2 * Math.PI) / 3;
  return x === 0
    ? 0
    : x === 1
      ? 1
      : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}

/** Ease in-out with elastic bounce */
export function easeInOutElastic(x: number): number {
  const c5 = (2 * Math.PI) / 4.5;
  return x === 0
    ? 0
    : x === 1
      ? 1
      : x < 0.5
        ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 +
          1;
}

// Bounce

/** Ease out with bounce */
export function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    return n1 * (x -= 1.5 / d1) * x + 0.75;
  } else if (x < 2.5 / d1) {
    return n1 * (x -= 2.25 / d1) * x + 0.9375;
  } else {
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }
}

/** Ease in with bounce */
export function easeInBounce(x: number): number {
  return 1 - easeOutBounce(1 - x);
}

/** Ease in-out with bounce */
export function easeInOutBounce(x: number): number {
  return x < 0.5
    ? (1 - easeOutBounce(1 - 2 * x)) / 2
    : (1 + easeOutBounce(2 * x - 1)) / 2;
}
