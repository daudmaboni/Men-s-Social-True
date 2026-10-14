import { describe, expect, it } from "vitest";
import { cleanProfile, initials, nameProblem, newestProfile } from "./profile";

describe("profile", () => {
  it("keeps only valid values", () => {
    expect(cleanProfile({ photo: "data:image/jpeg;base64,AAA", ageRange: "25–34", region: "Mwanza", updatedAt: "2026-10-14" })).toEqual({
      photo: "data:image/jpeg;base64,AAA",
      ageRange: "25–34",
      region: "Mwanza",
      updatedAt: "2026-10-14",
    });
    expect(cleanProfile({ photo: "https://evil/x.png", ageRange: "12", region: "Atlantis" })).toEqual({});
    expect(cleanProfile(null)).toEqual({});
  });
  it("the newest change wins between phone and account", () => {
    const a = { region: "Arusha", updatedAt: "2026-10-10T10:00:00Z" };
    const b = { region: "Tanga", updatedAt: "2026-10-12T10:00:00Z" };
    expect(newestProfile(a, b)).toBe(b);
    expect(newestProfile(b, a)).toBe(b);
    expect(newestProfile({}, b)).toBe(b);
    expect(newestProfile(a, {})).toBe(a);
  });
  it("blocks contact details in names", () => {
    expect(nameProblem("Juma")).toBeNull();
    expect(nameProblem("0712345678")).not.toBeNull();
    expect(nameProblem("juma@mail.com")).not.toBeNull();
  });
  it("makes initials", () => {
    expect(initials("juma ally")).toBe("JA");
    expect(initials("Juma")).toBe("J");
    expect(initials("  ")).toBe("");
  });
});
