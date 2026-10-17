import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Step 58: the app reads the sign-in saved on the phone instead of waiting for the server.

const KEY = "sb-abcdefgh-auth-token";
let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const user = { id: "u1", email: "a@b.c" };

describe("storedUser", () => {
  it("reads the session supabase-js saved for this project", async () => {
    const { storedUser } = await import("./useAccount");
    store[KEY] = JSON.stringify({ access_token: "x", refresh_token: "r", expires_at: 1, user });
    expect(storedUser()?.id).toBe("u1");
  });

  it("still trusts an expired session (the server renews or rejects it in the background)", async () => {
    const { storedUser } = await import("./useAccount");
    store[KEY] = JSON.stringify({ access_token: "x", refresh_token: "r", expires_at: 0, user });
    expect(storedUser()?.id).toBe("u1");
  });

  it("is nobody without a refresh token, with nothing saved, or with broken data", async () => {
    const { storedUser } = await import("./useAccount");
    expect(storedUser()).toBeNull();
    store[KEY] = JSON.stringify({ access_token: "x", user });
    expect(storedUser()).toBeNull();
    store[KEY] = "{not json";
    expect(storedUser()).toBeNull();
  });

  it("ignores another project's session", async () => {
    const { storedUser } = await import("./useAccount");
    store["sb-otherproj-auth-token"] = JSON.stringify({ refresh_token: "r", user });
    expect(storedUser()).toBeNull();
  });
});
