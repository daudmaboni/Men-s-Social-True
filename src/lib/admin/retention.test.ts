import { describe, expect, it } from "vitest";
import { retentionTotals } from "./retention";

describe("retention totals (Step 85)", () => {
  it("adds up only men whose next day / second week is over", () => {
    const t = retentionTotals({
      cohorts: [
        { week: "2026-10-19", signed_up: 10, day1_eligible: 8, day1: 4, week2_eligible: 0, week2: 0 },
        { week: "2026-10-05", signed_up: 6, day1_eligible: 6, day1: 3, week2_eligible: 6, week2: 2 },
      ],
    });
    expect(t).toEqual({ day1: 7, day1Eligible: 14, week2: 2, week2Eligible: 6 });
  });
});
