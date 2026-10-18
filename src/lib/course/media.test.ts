import { beforeEach, describe, expect, it, vi } from "vitest";

// Step 59: private lesson files play through one-day links.
let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] });
});

describe("lesson file links", () => {
  it("public addresses play as they are; private ones need a link", async () => {
    const m = await import("./media");
    expect(m.playable("https://x.co/a.m4a")).toBe("https://x.co/a.m4a");
    expect(m.isPrivateRef("private:course-media/courses/w/a.m4a")).toBe(true);
    expect(m.playable("private:course-media/courses/w/a.m4a")).toBe("");
    expect(m.playable(undefined)).toBe("");
  });

  it("uses a remembered link until shortly before it runs out", async () => {
    const ref = "private:course-media/courses/w/a.m4a";
    const now = Date.now();
    store["ms_media_links_v1"] = JSON.stringify({ [ref]: { url: "https://signed/1", exp: now + 3600_000 } });
    const m = await import("./media");
    expect(m.playable(ref, now)).toBe("https://signed/1");
    expect(m.playable(ref, now + 3600_000 - 30_000)).toBe(""); // less than a minute left: fetch a new one
  });

  it("forgets every link on sign-out", async () => {
    const ref = "private:course-media/courses/w/a.m4a";
    store["ms_media_links_v1"] = JSON.stringify({ [ref]: { url: "https://signed/1", exp: Date.now() + 3600_000 } });
    const m = await import("./media");
    m.forgetLinks();
    expect(m.playable(ref)).toBe("");
    expect(JSON.parse(store["ms_media_links_v1"])).toEqual({});
  });

  it("lists a course's private files", async () => {
    const m = await import("./media");
    const c = { modules: [{ lessons: [{ mediaUrl: "private:course-media/a" }, { mediaUrl: "https://x/b" }, {}] }] };
    expect(m.courseRefs(c as never)).toEqual(["private:course-media/a"]);
  });
});
