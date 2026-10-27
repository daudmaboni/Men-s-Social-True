// What part of a lesson he has really heard (Step 98). Pure functions, so they're easy to test.
//
// Before Step 98 the app kept one number, "seconds listened", and that went wrong both ways:
// - replaying the same minute three times counted as three minutes,
// - with the screen locked the phone reports the position only every few seconds, and those
//   bigger steps were thrown away as "skips", so real listening didn't count.
//
// Now we keep WHICH parts he heard, as time ranges ([[0, 190], [400, 480]] = 0:00–3:10 and 6:40–8:00).
// - A part counts once, however many times he replays it.
// - A step counts as listening when the real clock explains it (10 s passed at 1× → a 10 s step is fine),
//   so background listening counts. Dragging the slider or ±15 never counts.
// - Speed is fine: at 2× he covers the lesson twice as fast, and every part he passes counts.

/** Heard parts: sorted, non-overlapping [start, end) ranges in seconds. */
export type HeardParts = [number, number][];

/** Parts closer than this are joined (the gap is just timing noise between two reports). */
const JOIN = 0.75;
/** A skipped part shorter than this isn't worth telling him about. */
export const MIN_GAP = 5;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Clean anything we load (old data, data from another phone): numbers only, sorted, joined. */
export function cleanParts(raw: unknown): HeardParts {
  if (!Array.isArray(raw)) return [];
  const list: HeardParts = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const a = Number(p[0]);
    const b = Number(p[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b <= 0) continue;
    list.push([Math.max(0, a), b]);
  }
  return join(list);
}

function join(list: HeardParts): HeardParts {
  const sorted = [...list].sort((x, y) => x[0] - y[0]);
  const out: HeardParts = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + JOIN) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => [r1(a), r1(b)]);
}

/** Add one listened stretch [from, to). */
export function addPart(parts: HeardParts, from: number, to: number): HeardParts {
  if (!(to > from)) return parts;
  return join([...parts, [Math.max(0, from), to]]);
}

/** Everything heard on either phone. */
export function unionParts(a: HeardParts | undefined, b: HeardParts | undefined): HeardParts {
  return join([...(a ?? []), ...(b ?? [])]);
}

/** Seconds of the lesson he has heard (each second once). `len` cuts off anything past the end. */
export function heardSeconds(parts: HeardParts, len?: number): number {
  let s = 0;
  for (const [a, b] of parts) {
    const end = len && len > 0 ? Math.min(b, len) : b;
    if (end > a) s += end - a;
  }
  return s;
}

export function heardPercent(parts: HeardParts, len: number): number {
  if (!len || len <= 0) return 0;
  return Math.min(100, Math.floor((heardSeconds(parts, len) / len) * 100));
}

/**
 * Is this step real listening? `wallSec` is how much real time passed since the last report while it
 * was playing. Normal play moves about wallSec × speed; we allow some slack for phones that report late.
 * A seek (slider, ±15, lock-screen buttons) moves far more than the clock explains, so it doesn't count.
 */
export function isListening(prevPos: number, pos: number, wallSec: number, rate = 1): boolean {
  const d = pos - prevPos;
  if (!(d > 0)) return false;
  const r = Math.max(rate, 0.5);
  return d <= wallSec * r * 1.25 + 1.5;
}

/**
 * Parts he skipped, BEFORE the place he is now (what's after it is simply "not yet").
 * Only gaps of MIN_GAP seconds or more.
 */
export function skippedParts(parts: HeardParts, pos: number, len: number): HeardParts {
  const until = Math.min(pos, len || pos);
  const out: HeardParts = [];
  let at = 0;
  for (const [a, b] of parts) {
    if (a >= until) break;
    if (a - at >= MIN_GAP) out.push([at, a]);
    at = Math.max(at, b);
  }
  // He jumped forward and hasn't listened here yet: the hole runs up to where he is
  if (until - at >= MIN_GAP) out.push([at, until]);
  return out;
}

/** Progress saved before Step 98 had only "seconds heard": treat it as heard from the start. */
export function partsFromOld(heard: number | undefined, parts: unknown): HeardParts {
  const clean = cleanParts(parts);
  if (clean.length) return clean;
  return heard && heard > 0 ? [[0, r1(heard)]] : [];
}
