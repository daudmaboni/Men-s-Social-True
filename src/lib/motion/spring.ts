"use client";

// Springs for everything a finger can move (Step 76).
// Rules from Apple's "Designing Fluid Interfaces" talk:
// - A spring has no fixed duration. It has a damping ratio (1 = no bounce) and a response
//   (roughly how quickly it gets there, in seconds).
// - It starts from where the thing is on screen right now, and from how fast it is already moving,
//   so a flick carries straight into the animation with no seam.
// - It can be stopped at any moment (a finger touches it again) and started again from that spot.

export type SpringOptions = {
  /** 1 = settles without bouncing (default). Below 1 overshoots a little: only after a flick. */
  damping?: number;
  /** Seconds. Lower is snappier. */
  response?: number;
  /** Speed it is already moving at, in px per second (the finger's speed when he let go). */
  velocity?: number;
};

export type SpringState = { value: number; velocity: number };

/**
 * Where a spring is `t` seconds after starting at `from` with speed `v0`, heading to `to`.
 * Exact formula (no step-by-step drift), so the same input always gives the same frames.
 */
export function springAt(from: number, to: number, t: number, { damping = 1, response = 0.35, velocity = 0 }: SpringOptions = {}): SpringState {
  const w = (2 * Math.PI) / Math.max(response, 0.01); // natural frequency
  const z = Math.max(damping, 0);
  const x0 = from - to; // distance still to go (as an offset from the target)
  const v0 = velocity;
  if (z >= 1) {
    // Critically damped: smooth arrival, no overshoot
    const e = Math.exp(-w * t);
    const c = v0 + w * x0;
    const x = (x0 + c * t) * e;
    const v = (c - w * (x0 + c * t)) * e;
    return { value: to + x, velocity: v };
  }
  // Under-damped: a small overshoot, then rest
  const wd = w * Math.sqrt(1 - z * z);
  const e = Math.exp(-z * w * t);
  const b = (v0 + z * w * x0) / wd;
  const cos = Math.cos(wd * t);
  const sin = Math.sin(wd * t);
  const x = e * (x0 * cos + b * sin);
  const v = e * (-z * w * (x0 * cos + b * sin) + (-x0 * wd * sin + b * wd * cos));
  return { value: to + x, velocity: v };
}

const reduceMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export type SpringHandle = {
  /** Stop where it is (his finger caught it). */
  stop: () => void;
  /** Where it is right now and how fast it's moving. */
  now: () => SpringState;
  running: () => boolean;
};

/**
 * Animate a number with a spring, calling `onUpdate` every frame.
 * With "reduce motion" on, it jumps straight to the end.
 */
export function animateSpring(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  options: SpringOptions & { onDone?: () => void; restDelta?: number } = {},
): SpringHandle {
  const { onDone, restDelta = 0.5, ...spring } = options;
  let state: SpringState = { value: from, velocity: spring.velocity ?? 0 };
  let raf = 0;
  let live = true;
  const finish = () => {
    live = false;
    raf = 0;
    state = { value: to, velocity: 0 };
    onUpdate(to);
    onDone?.();
  };
  if (reduceMotion() || (Math.abs(to - from) < restDelta && Math.abs(state.velocity) < 10)) {
    finish();
    return { stop: () => {}, now: () => state, running: () => false };
  }
  const start = performance.now();
  const step = (time: number) => {
    const t = (time - start) / 1000;
    state = springAt(from, to, t, spring);
    if (Math.abs(state.value - to) < restDelta && Math.abs(state.velocity) < 20) return finish();
    onUpdate(state.value);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return {
    stop: () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      live = false;
    },
    now: () => state,
    running: () => live,
  };
}

/**
 * Past an edge, it still moves but less and less the further he pulls,
 * like stretching something real. `overshoot` in px, `size` = the screen or panel width.
 */
export function rubberband(overshoot: number, size: number, constant = 0.55): number {
  if (overshoot === 0 || size <= 0) return 0;
  return (overshoot * size * constant) / (size + constant * Math.abs(overshoot));
}

/** How much further a flick would carry something (px), from its speed in px/s. Apple's formula. */
export function project(velocity: number, decelerationRate = 0.99): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Finger speed from recent pointer samples, in px per second (0 if it had stopped). */
export function releaseVelocity(samples: { t: number; x: number }[], now = performance.now()): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (now - last.t > 80) return 0; // he held still before letting go
  const first = samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;
}
