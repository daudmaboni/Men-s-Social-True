import { describe, expect, it } from "vitest";
import { staffName, toLoginEmail, USERNAME_RULE } from "./username";

describe("studio usernames", () => {
  it("turns a username into the staff login address", () => {
    expect(toLoginEmail("TheAdmin")).toBe("theadmin@studio.menssocial.app");
    expect(toLoginEmail("  TheAdmin ")).toBe("theadmin@studio.menssocial.app");
  });
  it("leaves real emails alone", () => {
    expect(toLoginEmail("daud@example.com")).toBe("daud@example.com");
  });
  it("shows the username back", () => {
    expect(staffName("theadmin@studio.menssocial.app")).toBe("theadmin");
    expect(staffName("daud@example.com")).toBe("daud@example.com");
  });
  it("accepts sensible usernames only", () => {
    expect(USERNAME_RULE.test("TheAdmin")).toBe(true);
    expect(USERNAME_RULE.test("a b")).toBe(false);
  });
});
