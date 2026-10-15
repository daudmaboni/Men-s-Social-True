import { beforeEach, describe, expect, it } from "vitest";
import { checkPassword } from "./password";
import { cooldown, formatWait, recordFailure, recordSuccess, waitSeconds } from "./loginGuard";

describe("password strength", () => {
  it("refuses short, common, patterned and guessable passwords", () => {
    expect(checkPassword("abc12").ok).toBe(false);
    for (const pw of ["password", "12345678", "Tanzania", "simba123", "nakupenda", "qwerty123", "aaaaaaaa", "abcdefgh", "87654321"])
      expect(checkPassword(pw).ok, pw).toBe(false);
    expect(checkPassword("Simba2024!").problem).toMatch(/common word/);
    expect(checkPassword("jumamwita77", { email: "juma.mwita@gmail.com" }).problem).toMatch(/email name/);
  });

  it("accepts mixed passwords and long phrases", () => {
    expect(checkPassword("mvua7kesho").ok).toBe(true);
    expect(checkPassword("chai ya asubuhi mapema").ok).toBe(true);
    expect(checkPassword("mvua7kesho").score).toBe(3);
    expect(checkPassword("Mvua7-kesho-Moshi").score).toBe(4);
  });

  it("can ask for a longer minimum (Studio staff)", () => {
    const r = checkPassword("mvua7kes", { minLength: 12 });
    expect(r.ok).toBe(false);
    expect(r.problem).toBe("Use at least {n} characters.");
    expect(checkPassword("mvua7kesho-moshi", { minLength: 12 }).ok).toBe(true);
  });
});

describe("login slow-down", () => {
  beforeEach(() => recordSuccess("t", "juma@x.co"));

  it("gives 5 free tries, then waits longer each time, up to 15 minutes", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) expect(recordFailure("t", "juma@x.co", now)).toBe(0);
    expect(recordFailure("t", "juma@x.co", now)).toBe(30);
    expect(waitSeconds("t", "JUMA@x.co ", now + 10_000)).toBe(20); // same man, any spelling
    expect(recordFailure("t", "juma@x.co", now)).toBe(60);
    for (let i = 0; i < 10; i++) recordFailure("t", "juma@x.co", now);
    expect(waitSeconds("t", "juma@x.co", now)).toBe(15 * 60);
    recordSuccess("t", "juma@x.co");
    expect(waitSeconds("t", "juma@x.co", now)).toBe(0);
  });

  it("keeps each person separate", () => {
    for (let i = 0; i < 6; i++) recordFailure("t", "juma@x.co", 0);
    expect(waitSeconds("t", "ally@x.co", 0)).toBe(0);
  });

  it("limits how often a code can be sent", () => {
    expect(cooldown("sms", "+255712345678", 60, 0)).toBe(0);
    expect(cooldown("sms", "+255712345678", 60, 15_000)).toBe(45);
    expect(cooldown("sms", "+255712345678", 60, 61_000)).toBe(0);
  });

  it("formats waits", () => {
    expect(formatWait(30)).toBe("30 s");
    expect(formatWait(600)).toBe("10 min");
    expect(formatWait(45, "sw")).toBe("sekunde 45");
  });
});
