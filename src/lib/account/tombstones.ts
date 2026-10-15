// "Deleted" notes (tombstones) so a deletion on one phone isn't undone by another phone.
//
// When he deletes something, we write down WHAT he deleted and WHEN, e.g.
//   deleted["bm:sleep-guide"] = "2026-10-15T09:00:00.000Z"
// When two copies are merged, an item is dropped if it was deleted at or after its own last change.
// If he adds it again later, the newer add wins.
//
// Notes older than KEEP_DAYS are forgotten, so the list stays small. A phone that has been
// switched off for longer than that could bring back something deleted before then.

export type Tombstones = Record<string, string>;

export const KEEP_DAYS = 180;

/** All notes from both sides (newest time for each), minus very old ones. */
export function mergeTombstones(a: Tombstones | undefined, b: Tombstones | undefined, now: Date = new Date()): Tombstones {
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  const out: Tombstones = {};
  for (const src of [a ?? {}, b ?? {}]) {
    for (const [key, at] of Object.entries(src)) {
      if (typeof at !== "string" || at < cutoff) continue;
      if (!out[key] || at > out[key]) out[key] = at;
    }
  }
  return out;
}

/** Was this item deleted at or after `stamp` (its last change)? A missing stamp counts as "very old". */
export function isDeleted(t: Tombstones, key: string, stamp: string | undefined): boolean {
  const at = t[key];
  return Boolean(at) && at >= (stamp ?? "");
}

/** Copy of the notes with this item marked as deleted now. */
export function markDeleted(t: Tombstones | undefined, key: string, at: string = new Date().toISOString()): Tombstones {
  return { ...(t ?? {}), [key]: at };
}

/** Copy of the notes without this item (he added it again). */
export function unmarkDeleted(t: Tombstones | undefined, key: string): Tombstones {
  const next = { ...(t ?? {}) };
  delete next[key];
  return next;
}

/** Same data, ignoring the order of object keys (the database stores keys in its own order). */
export function sameData(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
