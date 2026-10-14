// Physics for the Liquid Glass tab bubble. Pure functions (no screen code), so they're easy to test.
// Positions are in "tabs": 0 = Social, 1 = Man, 2 = Me. Velocity is tabs per second.

export interface SpringState {
  x: number; // where the glass is
  v: number; // how fast it's moving
}

/** Spring tuned to feel quick with a small, soft overshoot (damping ratio ≈ 0.67). */
export const SPRING = { stiffness: 210, damping: 19.5 };

/** Move the spring one frame towards `target`. Small time steps keep it stable on slow phones. */
export function stepSpring(s: SpringState, target: number, dt: number, p = SPRING): SpringState {
  let { x, v } = s;
  let left = Math.min(dt, 0.064); // never jump more than ~4 frames at once
  while (left > 0) {
    const h = Math.min(left, 1 / 240);
    const a = p.stiffness * (target - x) - p.damping * v;
    v += a * h;
    x += v * h;
    left -= h;
  }
  return { x, v };
}

/** Close enough to stop animating (saves battery). */
export function isSettled(s: SpringState, target: number): boolean {
  return Math.abs(target - s.x) < 0.0015 && Math.abs(s.v) < 0.01;
}

export interface GlassShape {
  scaleX: number; // stretch along the movement
  scaleY: number; // gets a little thinner while stretched (keeps its "volume")
  origin: "left" | "right" | "center"; // the trailing edge stays put, the leading edge reaches ahead
  lean: number; // -1…1: which side is the front, for the uneven corners and the moving shine
}

/** Shape of the glass for its current speed: round at rest, stretched while moving. */
export function shapeFor(v: number): GlassShape {
  const speed = Math.abs(v);
  const stretch = Math.min(speed * 0.075, 0.3);
  const lean = Math.max(-1, Math.min(1, v / 3));
  return {
    scaleX: 1 + stretch,
    scaleY: 1 - stretch * 0.38,
    origin: speed < 0.05 ? "center" : v > 0 ? "left" : "right",
    lean,
  };
}
