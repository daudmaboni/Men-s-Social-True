import { describe, expect, it } from "vitest";
import { activityScore, checkPost, checkReply, reactionCount, timeAgo, toggleReaction } from "./community";
import { SAMPLE_POSTS, SAMPLE_REPLIES } from "./fixtures";

describe("post safety checks", () => {
  it("accepts a normal question", () => {
    expect(checkPost("How do you calm nerves before a date?", "Any tips?")).toBeNull();
  });
  it("asks for a longer question", () => {
    expect(checkPost("Help", "")).toMatch(/few more words/);
  });
  it("blocks phone numbers, links and contact requests", () => {
    expect(checkPost("Call me for advice please", "0712 345 678")).toMatch(/Phone numbers/);
    expect(checkPost("Check this website now", "www.example.com")).toMatch(/Links/);
    expect(checkPost("Nipigie kwa ushauri zaidi", "")).toMatch(/private contact/);
    expect(checkPost("Inbox me if you need help", "")).toMatch(/private contact/);
  });
  it("blocks selling and prices", () => {
    expect(checkPost("Strong dawa available for men", "Bei nafuu, delivery Dar")).toMatch(/Selling/);
    expect(checkPost("Good product for energy", "Only 20000 TZS")).toMatch(/Selling/);
  });
  it("checks replies too", () => {
    expect(checkReply("")).toMatch(/Write a reply/);
    expect(checkReply("You're not alone, brother.")).toBeNull();
    expect(checkReply("WhatsApp me")).toMatch(/private contact/);
  });
});

describe("reactions", () => {
  it("toggles his reaction on and off", () => {
    expect(toggleReaction(undefined, "support")).toEqual(["support"]);
    expect(toggleReaction(["support"], "support")).toEqual([]);
    expect(toggleReaction(["support"], "helpful")).toEqual(["support", "helpful"]);
  });
  it("adds his reaction to the existing count", () => {
    expect(reactionCount({ support: 4 }, ["support"], "support")).toBe(5);
    expect(reactionCount({ support: 4 }, [], "support")).toBe(4);
    expect(reactionCount(undefined, undefined, "same")).toBe(0);
  });
  it("ranks replies above reactions for 'most active'", () => {
    expect(activityScore(2, 0)).toBeGreaterThan(activityScore(0, 5));
  });
});

describe("sample posts", () => {
  it("are all labelled as samples and pass the same safety checks", () => {
    for (const p of SAMPLE_POSTS) {
      expect(p.fixture).toBe(true);
      expect(checkPost(p.title, p.body), p.id).toBeNull();
    }
    for (const r of SAMPLE_REPLIES) {
      expect(r.fixture).toBe(true);
      expect(checkReply(r.body), r.id).toBeNull();
      expect(SAMPLE_POSTS.some((p) => p.id === r.postId)).toBe(true);
    }
  });
});

describe("time labels", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("shows short relative times", () => {
    expect(timeAgo("2026-10-13T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-13T11:15:00Z", now)).toBe("45m ago");
    expect(timeAgo("2026-10-13T07:00:00Z", now)).toBe("5h ago");
    expect(timeAgo("2026-10-11T12:00:00Z", now)).toBe("2d ago");
  });
});
