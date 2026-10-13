// "Download my data" and "Delete everything" for the Me tab.
// Everything Men's Social saves on the phone uses keys starting with "ms_".

type StorageLike = Pick<Storage, "length" | "key" | "getItem" | "removeItem">;

export const APP_PREFIX = "ms_";
/** Kept on delete: a copy of public content, not his data. */
const NOT_PERSONAL = new Set(["ms_content_cache_v1"]);

function appKeys(store: StorageLike): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith(APP_PREFIX) && !NOT_PERSONAL.has(k)) keys.push(k);
  }
  return keys.sort();
}

/** Everything saved about him, as readable JSON. */
export function exportMyData(store: StorageLike, now = new Date()) {
  const data: Record<string, unknown> = {};
  for (const k of appKeys(store)) {
    const raw = store.getItem(k);
    try {
      data[k] = raw === null ? null : JSON.parse(raw);
    } catch {
      data[k] = raw;
    }
  }
  return {
    app: "Men's Social",
    exportedAt: now.toISOString(),
    note: "Everything this app saved on this phone. Nothing here was sent to a server.",
    data,
  };
}

/** Removes all his data from this phone. Returns how many items were removed. */
export function deleteMyData(store: StorageLike): number {
  const keys = appKeys(store);
  keys.forEach((k) => store.removeItem(k));
  return keys.length;
}
