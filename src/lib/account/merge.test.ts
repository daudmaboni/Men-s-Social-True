import { describe, expect, it } from "vitest";
import { mergeFeed, mergeProgress, mergeSocial, normalizeTzPhone } from "./merge";
import type { TrackingRecord } from "../progress/types";
import type { SocialDB } from "../social/store";

const rec = (id: string, value: number, updatedAt: string): TrackingRecord => ({
  id, userId: "local", metric: "water", value, unit: "ml", source: "manual",
  recordedAt: "2026-10-13T08:00:00Z", localDate: "2026-10-13", createdAt: "2026-10-13T08:00:00Z", updatedAt,
});
const emptySocial: SocialDB = { bookmarks: {}, interests: [], nickname: "", posts: [], replies: [], reactions: {}, reports: {}, history: {}, profile: {} };

describe("merging phone data with his account", () => {
  it("keeps records from both sides and the newest edit of the same record", () => {
    const local = { records: [rec("a", 250, "2026-10-13T09:00:00Z"), rec("b", 500, "2026-10-13T09:00:00Z")], goals: [] };
    const remote = { records: [rec("a", 300, "2026-10-13T10:00:00Z"), rec("c", 750, "2026-10-12T09:00:00Z")], goals: [] };
    const m = mergeProgress(local, remote, "user-1");
    expect(m.records.map((r) => [r.id, r.value]).sort()).toEqual([["a", 300], ["b", 500], ["c", 750]]);
    expect(m.records.every((r) => r.userId === "user-1")).toBe(true);
  });
  it("keeps the goal he changed most recently, and his account's goal over a default", () => {
    const def = { metric: "water" as const, target: 2500, unit: "ml" as const, period: "day" as const, direction: "increase" as const, updatedAt: "" };
    const set = { ...def, target: 3000, updatedAt: "2026-10-10T00:00:00Z" };
    expect(mergeProgress({ records: [], goals: [def] }, { goals: [set] }).goals[0].target).toBe(3000);
  });
  it("works when the account is empty (first sign-in)", () => {
    const local = { records: [rec("a", 250, "x")], goals: [] };
    expect(mergeProgress(local, null).records).toHaveLength(1);
  });
  it("merges daily choices and lessons from both phones", () => {
    const local = { days: { "2026-10-13": { walk: { status: "done" as const, at: "2026-10-13T10:00:00Z" } } }, lessons: { l1: { localDate: "2026-10-13", at: "2026-10-13T10:00:00Z" } }, settings: { discreet: false } };
    const remote = { days: { "2026-10-13": { walk: { status: "later" as const, at: "2026-10-13T08:00:00Z" }, meal: { status: "done" as const, at: "2026-10-13T08:00:00Z" } } }, lessons: { l1: { localDate: "2026-10-12", at: "2026-10-12T10:00:00Z" } }, settings: { discreet: true } };
    const m = mergeFeed(local, remote);
    expect(m.days["2026-10-13"].walk.status).toBe("done");
    expect(m.days["2026-10-13"].meal.status).toBe("done");
    expect(m.lessons.l1.localDate).toBe("2026-10-12");
    expect(m.settings.discreet).toBe(true);
  });
  it("merges bookmarks, topics and reactions, keeping his name from this phone", () => {
    const local = { ...emptySocial, bookmarks: { a: "1" }, interests: ["libido" as const], nickname: "Juma", reactions: { p1: ["helpful" as never] } };
    const remote = { ...emptySocial, bookmarks: { b: "2" }, interests: ["libido" as const, "confidence" as const], nickname: "J", reactions: { p1: ["support" as never] } };
    const m = mergeSocial(local, remote);
    expect(Object.keys(m.bookmarks).sort()).toEqual(["a", "b"]);
    expect(m.interests).toEqual(["libido", "confidence"]);
    expect(m.nickname).toBe("Juma");
    expect(m.reactions.p1.sort()).toEqual(["helpful", "support"]);
    expect(mergeSocial({ ...emptySocial }, remote).nickname).toBe("J");
  });
});

describe("Tanzanian phone numbers", () => {
  it("accepts the usual ways people write them", () => {
    for (const p of ["0712 345 678", "+255712345678", "255 712 345 678", "712345678", "0654-123-456"]) {
      expect(normalizeTzPhone(p), p).toMatch(/^\+255[67]\d{8}$/);
    }
    expect(normalizeTzPhone("0712 345 678")).toBe("+255712345678");
  });
  it("rejects numbers that aren't Tanzanian mobiles", () => {
    for (const p of ["12345", "0812345678", "+254712345678", "07123456789"]) expect(normalizeTzPhone(p), p).toBeNull();
  });
});

describe("profile merge", () => {
  it("keeps the profile (and name) he changed last", () => {
    const phone = { ...emptySocial, nickname: "Juma", profile: { region: "Mwanza", updatedAt: "2026-10-14T10:00:00Z" } };
    const account = { ...emptySocial, nickname: "Old name", profile: { region: "Tanga", updatedAt: "2026-10-01T10:00:00Z" } };
    expect(mergeSocial(phone, account)).toMatchObject({ nickname: "Juma", profile: { region: "Mwanza" } });
    expect(mergeSocial(account, phone)).toMatchObject({ nickname: "Juma", profile: { region: "Mwanza" } });
  });
  it("a deleted profile stays deleted", () => {
    const cleared = { ...emptySocial, nickname: "", profile: { updatedAt: "2026-10-14T10:00:00Z" } };
    const older = { ...emptySocial, nickname: "Juma", profile: { region: "Tanga", updatedAt: "2026-10-01T10:00:00Z" } };
    expect(mergeSocial(cleared, older)).toMatchObject({ nickname: "", profile: { updatedAt: "2026-10-14T10:00:00Z" } });
  });
  it("accounts saved before profiles existed still merge", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { profile, ...old } = emptySocial;
    expect(mergeSocial({ ...emptySocial, nickname: "Juma" }, { ...old, nickname: "J" }).nickname).toBe("Juma");
  });
});

describe("deletions stay deleted (Step 35)", () => {
  const NOW = new Date("2026-10-15T12:00:00Z");
  const T = (h: number) => `2026-10-15T${String(h).padStart(2, "0")}:00:00.000Z`;

  it("a record deleted on one phone doesn't come back from the other", () => {
    const phoneA = { records: [rec("b", 500, T(9))], goals: [], deleted: { "rec:a": T(10) } };
    const phoneB = { records: [rec("a", 250, T(9)), rec("b", 500, T(9))], goals: [] };
    expect(mergeProgress(phoneA, phoneB, undefined, NOW).records.map((r) => r.id)).toEqual(["b"]);
    expect(mergeProgress(phoneB, phoneA, undefined, NOW).records.map((r) => r.id)).toEqual(["b"]);
  });
  it("an edit made after the deletion wins (he changed it on the other phone later)", () => {
    const m = mergeProgress({ records: [], goals: [], deleted: { "rec:a": T(9) } }, { records: [rec("a", 300, T(10))] }, undefined, NOW);
    expect(m.records.map((r) => r.id)).toEqual(["a"]);
  });
  it("a removed bookmark stays removed; saving it again later brings it back", () => {
    const removed = { ...emptySocial, deleted: { "bm:guide": T(10) } };
    const old = { ...emptySocial, bookmarks: { guide: T(8), other: T(8) } };
    expect(Object.keys(mergeSocial(old, removed, NOW).bookmarks)).toEqual(["other"]);
    const savedAgain = { ...emptySocial, bookmarks: { guide: T(11) } };
    expect(Object.keys(mergeSocial(savedAgain, removed, NOW).bookmarks)).toEqual(["guide"]);
  });
  it("deleted posts take their replies with them; deleted replies, reactions and reports stay gone", () => {
    const post = { id: "p1", topic: "general", title: "t", body: "b", author: { name: "A", anonymous: true }, createdAt: T(8), wantsExpert: false, mine: true };
    const reply = { id: "r1", postId: "p1", body: "x", author: { name: "A", anonymous: true }, createdAt: T(8), mine: true };
    const reply2 = { ...reply, id: "r2", postId: "p2" };
    const old = { ...emptySocial, posts: [post], replies: [reply, reply2], reactions: { p9: ["helpful", "support"] }, reports: { p7: { reason: "spam", at: T(8) } } } as unknown as SocialDB;
    const phone = { ...emptySocial, deleted: { "post:p1": T(10), "reply:r2": T(10), "react:p9:helpful": T(10), "report:p7": T(10) } };
    const m = mergeSocial(old, phone, NOW);
    expect(m.posts).toEqual([]);
    expect(m.replies).toEqual([]);
    expect(m.reactions).toEqual({ p9: ["support"] });
    expect(m.reports).toEqual({});
  });
  it("a reaction added again after removing it comes back", () => {
    const removedThenAdded = { ...emptySocial, reactions: { p9: ["helpful" as never] }, reactedAt: { "p9:helpful": T(11) } };
    const removedElsewhere = { ...emptySocial, deleted: { "react:p9:helpful": T(10) } };
    expect(mergeSocial(removedElsewhere, removedThenAdded, NOW).reactions).toEqual({ p9: ["helpful"] });
  });
  it("the topic list he changed last wins, so removing a topic works", () => {
    const newer = { ...emptySocial, interests: ["libido" as const], interestsAt: T(10) };
    const older = { ...emptySocial, interests: ["libido" as const, "confidence" as const], interestsAt: T(8) };
    expect(mergeSocial(older, newer, NOW).interests).toEqual(["libido"]);
    expect(mergeSocial(newer, older, NOW).interests).toEqual(["libido"]);
  });
  it("Undo on an activity stays undone, and discreet mode can be switched off on another phone", () => {
    const undone = { days: { "2026-10-15": {} }, lessons: {}, settings: { discreet: false, updatedAt: T(10) }, deleted: { "choice:2026-10-15:walk": T(10) } };
    const old = { days: { "2026-10-15": { walk: { status: "done" as const, at: T(9) } } }, lessons: {}, settings: { discreet: true, updatedAt: T(8) } };
    const m = mergeFeed(old, undone, NOW);
    expect(m.days["2026-10-15"]?.walk).toBeUndefined();
    expect(m.settings.discreet).toBe(false);
    // Done again later than the Undo → counts
    const again = { ...old, days: { "2026-10-15": { walk: { status: "done" as const, at: T(11) } } } };
    expect(mergeFeed(again, undone, NOW).days["2026-10-15"].walk.status).toBe("done");
  });
  it("very old deletion notes are forgotten so the list stays small", () => {
    const m = mergeProgress({ records: [], goals: [], deleted: { "rec:old": "2026-01-01T00:00:00.000Z", "rec:new": T(9) } }, null, undefined, NOW);
    expect(Object.keys(m.deleted ?? {})).toEqual(["rec:new"]);
  });
  it("merging again changes nothing, whichever phone goes first", () => {
    const a = { ...emptySocial, bookmarks: { x: T(8) }, interests: ["libido" as const], history: { g1: T(8) }, deleted: { "bm:y": T(9) } };
    const b = { ...emptySocial, bookmarks: { y: T(7), z: T(9) }, interests: ["confidence" as const], history: { g2: T(9) } };
    const ab = mergeSocial(a, b, NOW);
    expect(mergeSocial(ab, b, NOW)).toEqual(ab);
    expect(mergeSocial(a, ab, NOW)).toEqual(ab);
    const pa = { records: [rec("b", 1, T(9)), rec("a", 2, T(9))], goals: [] };
    const pm = mergeProgress(pa, { records: [rec("c", 3, T(9))] }, "u", NOW);
    expect(mergeProgress(pm, pa, "u", NOW)).toEqual(pm);
  });
});

describe("challenges across phones (Step 86)", () => {
  const base = { days: {}, lessons: {}, settings: { discreet: false } };
  it("keeps days done on both phones and the first finish", () => {
    const a = { ...base, challenges: { k: { start: "2026-10-20", at: "2026-10-20T08:00:00Z", length: 3, days: { "2026-10-20": "t1" } } } };
    const b = { ...base, challenges: { k: { start: "2026-10-20", at: "2026-10-20T08:00:00Z", length: 3, days: { "2026-10-21": "t2", "2026-10-22": "t3" }, finished: { localDate: "2026-10-22", at: "t3", points: 30 } } } };
    const m = mergeFeed(a, b);
    expect(Object.keys(m.challenges!.k.days).sort()).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(m.challenges!.k.finished?.points).toBe(30);
    expect(mergeFeed(b, a)).toEqual(m);
  });
  it("a fresh start replaces the old one, and quitting sticks", () => {
    const old = { ...base, challenges: { k: { start: "2026-09-01", at: "2026-09-01T08:00:00Z", length: 3, days: { "2026-09-01": "x" } } } };
    const fresh = { ...base, challenges: { k: { start: "2026-10-20", at: "2026-10-20T08:00:00Z", length: 7, days: {} } } };
    expect(mergeFeed(old, fresh).challenges!.k.length).toBe(7);
    const quit = { ...base, challenges: {}, deleted: { "challenge:k": "2026-10-21T00:00:00Z" } };
    expect(mergeFeed(quit, fresh).challenges!.k).toBeUndefined();
  });
});
