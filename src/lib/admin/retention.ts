// Shapes and sums for the retention numbers (admin_retention, migration 0018). Step 85.

export type Cohort = { week: string; signed_up: number; day1_eligible: number; day1: number; week2_eligible: number; week2: number };
export type RetentionData = { weeks: number; signed_up: number; cohorts: Cohort[]; first: Record<string, number> };

/** All weeks together; a rate only counts men whose next day / second week is already over. */
export function retentionTotals(d: Pick<RetentionData, "cohorts">) {
  return d.cohorts.reduce(
    (s, c) => ({
      day1: s.day1 + c.day1,
      day1Eligible: s.day1Eligible + c.day1_eligible,
      week2: s.week2 + c.week2,
      week2Eligible: s.week2Eligible + c.week2_eligible,
    }),
    { day1: 0, day1Eligible: 0, week2: 0, week2Eligible: 0 },
  );
}
