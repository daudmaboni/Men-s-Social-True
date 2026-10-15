import { describe, expect, it } from "vitest";
import { isNewAccount, maskHint } from "./known";

describe("remembering a member on this phone", () => {
  it("keeps only a masked hint, never the full email or number", () => {
    expect(maskHint({ email: "daudimaboni23@gmail.com", user_metadata: {} })).toBe("da•••@gmail.com");
    expect(maskHint({ phone: "255712345678", user_metadata: {} })).toBe("+255 ••• 678");
    expect(maskHint({ email: "x@y.com", user_metadata: { given_name: "Daud" } })).toBe("Daud");
  });
  it("tells a brand-new Google account from a returning one", () => {
    expect(isNewAccount({ created_at: "2026-10-15T10:00:00Z", last_sign_in_at: "2026-10-15T10:00:01Z" })).toBe(true);
    expect(isNewAccount({ created_at: "2026-09-01T10:00:00Z", last_sign_in_at: "2026-10-15T10:00:00Z" })).toBe(false);
  });
});
