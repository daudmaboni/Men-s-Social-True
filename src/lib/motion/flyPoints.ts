"use client";

// Points fly to where they're kept (Step 77). When he finishes something, a "+15" pill rises from what he
// tapped and travels to his points on the Today card (anything marked data-points-target), which gives a
// small bump and a buzz when they land. X and Y each have their own spring, so it arcs instead of moving
// in a straight line. If no points counter is on screen, the pill just floats up and fades, as before.

import { animateSpring } from "./spring";
import { haptic } from "./haptics";

const reduceMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The points counter he can see right now, if any. */
function visibleTarget(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>("[data-points-target]"));
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) return el;
  }
  return null;
}

/** Make the counter give a small bump (the CSS class restarts its animation). */
function bump(el: HTMLElement) {
  el.classList.remove("points-hit");
  void el.offsetWidth;
  el.classList.add("points-hit");
}

export function flyPoints(from: Element | null | undefined, points: number) {
  if (typeof document === "undefined" || !points) return;
  const src = from?.getBoundingClientRect();
  const start = src ? { x: src.left + src.width / 2, y: src.top + src.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const target = visibleTarget();

  const pill = document.createElement("span");
  pill.textContent = `+${points}`;
  pill.className = "points-fly";
  pill.setAttribute("aria-hidden", "true");
  document.body.appendChild(pill);
  const put = (x: number, y: number, s: number, o: number) => {
    pill.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${s})`;
    pill.style.opacity = String(o);
  };
  put(start.x, start.y, 0.6, 0);

  // Nowhere to go (or reduce motion): rise a little and fade, the old way
  if (!target || reduceMotion()) {
    let y = start.y;
    animateSpring(0, 1, (p) => {
      y = start.y - 36 * p;
      put(start.x, y, 0.9 + 0.15 * Math.min(p * 3, 1), p < 0.25 ? p * 4 : 1 - (p - 0.25) / 0.75);
    }, { damping: 1, response: 0.6, onDone: () => pill.remove() });
    if (target && reduceMotion()) {
      bump(target);
      haptic("success");
    }
    return;
  }

  const end = target.getBoundingClientRect();
  const goal = { x: end.left + end.width / 2, y: end.top + end.height / 2 };
  // First a quick pop up from the button (it hints where it's going), then X and Y travel on separate springs
  let x = start.x;
  let y = start.y;
  let s = 0.6;
  let landed = 0;
  const land = () => {
    if (++landed < 2) return;
    pill.remove();
    bump(target);
    haptic("success");
  };
  animateSpring(0, 1, (p) => {
    s = 0.6 + 0.5 * p;
    put(x, y, s, Math.min(1, p * 2));
  }, { damping: 0.7, response: 0.22 });
  animateSpring(start.x, goal.x, (v) => {
    x = v;
    put(x, y, s, 1);
  }, { damping: 1, response: 0.5, onDone: land });
  animateSpring(start.y, goal.y, (v) => {
    y = v;
    put(x, y, s, 1);
  }, { damping: 0.9, response: 0.42, velocity: -900, onDone: land });
}
