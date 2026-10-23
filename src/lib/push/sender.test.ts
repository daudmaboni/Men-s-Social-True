import { describe, expect, it, vi } from "vitest";
import { payloadFor, sendDue, type DueRow } from "./sender";

const row = (over: Partial<DueRow>): DueRow => ({
  subscription_id: "s1",
  user_id: "u1",
  endpoint: "https://push.example/1",
  p256dh: "k",
  auth: "a",
  kind: "reminder",
  ref: "2026-10-23",
  title: "Men's Social",
  body: "Your day is ready: a quick check-in and one thing to try.",
  link: "/man",
  ...over,
});

describe("push sender (Step 79)", () => {
  it("sends what's due and marks it sent", async () => {
    const mark = vi.fn(async () => {});
    const send = vi.fn(async () => ({}));
    const r = await sendDue({ due: async () => [row({}), row({ subscription_id: "s2", kind: "campaign", ref: "c1", link: "/social" })], mark }, send);
    expect(r).toEqual({ due: 2, sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(mark).toHaveBeenCalledWith(
      [
        { subscription_id: "s1", user_id: "u1", kind: "reminder", ref: "2026-10-23" },
        { subscription_id: "s2", user_id: "u1", kind: "campaign", ref: "c1" },
      ],
      [],
    );
  });

  it("forgets phones the push service says are gone, and counts other failures", async () => {
    const mark = vi.fn(async () => {});
    const send = vi.fn(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("/gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      if (sub.endpoint.endsWith("/busy")) throw Object.assign(new Error("Busy"), { statusCode: 503 });
      return {};
    });
    await sendDue(
      { due: async () => [row({ subscription_id: "g", endpoint: "https://p/gone" }), row({ subscription_id: "b", endpoint: "https://p/busy" })], mark },
      send,
    );
    expect(mark).toHaveBeenCalledWith([], [
      { subscription_id: "g", gone: true },
      { subscription_id: "b", gone: false },
    ]);
  });

  it("does nothing when nothing is due", async () => {
    const mark = vi.fn(async () => {});
    const r = await sendDue({ due: async () => [], mark }, vi.fn());
    expect(r.sent).toBe(0);
    expect(mark).not.toHaveBeenCalled();
  });

  it("the phone gets only the discreet title, the text and where to open", () => {
    const p = JSON.parse(payloadFor(row({})));
    expect(p).toEqual({ title: "Men's Social", body: "Your day is ready: a quick check-in and one thing to try.", link: "/man", tag: "ms-reminder" });
  });
});
