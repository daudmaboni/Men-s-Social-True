// Two phones, one account: deletions and changes on one phone must survive the other phone saving.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── A pretend Supabase `user_data` table (stores copies, like jsonb; updated_at changes on every save)
type Row = { data: unknown; updated_at: string };
const table = new Map<string, Row>();
let clock = 0;
let beforeUpdate: (() => void) | null = null;
const stamp = () => new Date(Date.UTC(2026, 9, 15) + ++clock).toISOString().replace("Z", "000+00:00");
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function query(run: (f: Record<string, string>) => unknown) {
  const f: Record<string, string> = {};
  const q = {
    eq(k: string, v: string) {
      f[k] = v;
      return q;
    },
    maybeSingle: async () => run(f),
    select: async () => run(f),
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) => Promise.resolve(run(f)).then(res, rej),
  };
  return q;
}
const fake = {
  from: () => ({
    select: () => query((f) => ({ data: table.has(`${f.user_id}|${f.kind}`) ? copy(table.get(`${f.user_id}|${f.kind}`)) : null, error: null })),
    update: (patch: { data: unknown }) =>
      query((f) => {
        beforeUpdate?.();
        beforeUpdate = null;
        const key = `${f.user_id}|${f.kind}`;
        const row = table.get(key);
        if (!row || row.updated_at !== f.updated_at) return { data: [], error: null };
        table.set(key, { data: copy(patch.data), updated_at: stamp() });
        return { data: [{ updated_at: table.get(key)!.updated_at }], error: null };
      }),
    insert: async (row: { user_id: string; kind: string; data: unknown }) => {
      const key = `${row.user_id}|${row.kind}`;
      if (table.has(key)) return { error: { code: "23505", message: "duplicate" } };
      table.set(key, { data: copy(row.data), updated_at: stamp() });
      return { error: null };
    },
  }),
};
vi.mock("../supabase/client", () => ({ getSupabase: () => fake }));

// ── Each phone has its own storage and its own copy of the app's modules
let active: Map<string, string> = new Map();
const storage = {
  getItem: (k: string) => active.get(k) ?? null,
  setItem: (k: string, v: string) => void active.set(k, v),
  removeItem: (k: string) => void active.delete(k),
};

async function newPhone() {
  vi.resetModules();
  const mem = new Map<string, string>();
  active = mem;
  const sync = await import("./sync");
  const social = await import("../social/store");
  const progress = await import("../progress/store");
  const feed = await import("../feed/store");
  /** Run something "on this phone". */
  const on = async <T,>(fn: () => T | Promise<T>): Promise<T> => {
    active = mem;
    const out = await fn();
    await sync.flushSync();
    return out;
  };
  return { on, sync, social, progress, feed };
}

/** Let the clock move on a little, so later changes get later times. */
const tick = () => {
  const t = Date.now();
  while (Date.now() - t < 3) {
    /* wait */
  }
};
const USER = "u1";

beforeEach(() => {
  table.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("two phones, one account", () => {
  it("a bookmark removed on phone A doesn't come back when phone B saves", async () => {
    const A = await newPhone();
    await A.on(() => A.social.socialStore.toggleBookmark("guide"));
    await A.on(() => A.sync.startSync(USER));
    const B = await newPhone();
    await B.on(() => B.sync.startSync(USER));
    expect(Object.keys(await B.on(() => B.social.socialSync.get().bookmarks))).toEqual(["guide"]);

    tick();
    await A.on(() => A.social.socialStore.toggleBookmark("guide")); // removed on A
    tick();
    await B.on(() => B.social.socialStore.toggleBookmark("other")); // B saves its (older) copy

    expect(Object.keys((table.get(`${USER}|social`)!.data as { bookmarks: object }).bookmarks)).toEqual(["other"]);
    expect(Object.keys(await B.on(() => B.social.socialSync.get().bookmarks))).toEqual(["other"]);
  });

  it("phone B saving doesn't wipe a record phone A added, nor bring back one A deleted", async () => {
    const A = await newPhone();
    await A.on(() => A.sync.startSync(USER));
    const old = await A.on(() => A.progress.progressStore.addRecord({ metric: "water", value: 250, unit: "ml", source: "quick_add" }));
    const B = await newPhone();
    await B.on(() => B.sync.startSync(USER)); // B now has the 250 ml record

    tick();
    await A.on(() => A.progress.progressStore.deleteRecord(old!.id));
    await A.on(() => A.progress.progressStore.addRecord({ metric: "water", value: 500, unit: "ml", source: "quick_add" }));
    tick();
    await B.on(() => B.progress.progressStore.addRecord({ metric: "water", value: 750, unit: "ml", source: "quick_add" }));

    const saved = (table.get(`${USER}|progress`)!.data as { records: { value: number }[] }).records.map((r) => r.value).sort();
    expect(saved).toEqual([500, 750]);
    const onB = (await B.on(() => B.progress.progressSync.get().records)).map((r) => r.value).sort();
    expect(onB).toEqual([500, 750]);
  });

  it("if another phone saves at the same moment, both changes are kept", async () => {
    const A = await newPhone();
    await A.on(() => A.sync.startSync(USER));
    const B = await newPhone();
    await B.on(() => B.sync.startSync(USER));

    // While A is saving, B's save lands first
    beforeUpdate = () => {
      const row = table.get(`${USER}|social`)!;
      const data = copy(row.data) as { bookmarks: Record<string, string> };
      data.bookmarks.fromB = new Date().toISOString();
      table.set(`${USER}|social`, { data, updated_at: stamp() });
    };
    await A.on(() => A.social.socialStore.toggleBookmark("fromA"));
    expect(Object.keys((table.get(`${USER}|social`)!.data as { bookmarks: object }).bookmarks).sort()).toEqual(["fromA", "fromB"]);
  });

  it("Undo, discreet off and a removed topic carry over to the other phone", async () => {
    const A = await newPhone();
    await A.on(() => A.sync.startSync(USER));
    await A.on(() => {
      A.feed.feedStore.setChoice("walk", "done");
      A.feed.feedStore.setDiscreet(true);
      A.social.socialStore.setInterests(["libido", "confidence"]);
    });
    const B = await newPhone();
    await B.on(() => B.sync.startSync(USER));
    tick();
    await A.on(() => {
      A.feed.feedStore.clearChoice("walk");
      A.feed.feedStore.setDiscreet(false);
      A.social.socialStore.setInterests(["libido"]);
    });
    tick();
    await B.on(() => B.social.socialStore.toggleBookmark("x")); // B saves its older copy of everything it changes
    await B.on(() => B.feed.feedStore.markLessonRead("l1"));

    const feed = await B.on(() => B.feed.feedSync.get());
    expect(Object.values(feed.days).flatMap((d) => Object.keys(d))).toEqual([]);
    expect(feed.settings.discreet).toBe(false);
    expect((await B.on(() => B.social.socialSync.get())).interests).toEqual(["libido"]);
  });
});
