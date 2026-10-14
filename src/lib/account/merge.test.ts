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
