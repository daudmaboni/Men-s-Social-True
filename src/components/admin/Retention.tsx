"use client";

// Studio → Analytics → "Do men come back?" (Step 85). The real test of the pilot: of the men who signed up,
// how many came back the next day, and how many were still using it in their second week. Plus what men
// did first. Counts only (admin_retention, migration 0018); a rate shows only once that day/week is over.

import { Panel, Stat, useLoad } from "./ui";
import { RankBars } from "./Chart";
import { rpc } from "@/lib/admin/api";
import { retentionTotals, type RetentionData } from "@/lib/admin/retention";

const FIRST_LABEL: Record<string, string> = {
  card: "Did a Discover card (I did it)",
  activity: "Did an activity on Man",
  lesson: "Listened to / read a lesson",
  tracker: "Logged water or sleep",
  checkin: "Did a check-in",
  nothing: "Nothing yet in the first 7 days",
};

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
const weekLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function Retention() {
  const r = useLoad(() => rpc<RetentionData>("admin_retention", { p_weeks: 8 }), []);
  if (r.loading) return null;
  if (r.error || !r.data) {
    return (
      <Panel title="Do men come back?" sub="Needs migration 0018">
        <p className="text-sm text-ink-soft">Run supabase/migrations/0018_feedback_and_retention.sql in Supabase (SQL Editor) to see these numbers.</p>
      </Panel>
    );
  }
  const d = r.data;
  const t = retentionTotals(d);
  const first = Object.entries(d.first)
    .map(([k, n]) => ({ label: FIRST_LABEL[k] ?? k, n }))
    .sort((a, b) => b.n - a.n);

  return (
    <Panel title="Do men come back?" sub={`Men who signed up in the last ${d.weeks} weeks (staff not counted). The pilot's real test.`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Signed up" value={d.signed_up} />
        <Stat
          label="Came back the next day"
          value={t.day1Eligible ? pct(t.day1, t.day1Eligible) : null}
          hint={t.day1Eligible ? `${t.day1} of ${t.day1Eligible} men` : "Shows once a day has passed"}
        />
        <Stat
          label="Still using it in week 2"
          value={t.week2Eligible ? pct(t.week2, t.week2Eligible) : null}
          hint={t.week2Eligible ? `${t.week2} of ${t.week2Eligible} men (days 7–13 after sign-up)` : "Shows 2 weeks after the first sign-ups"}
        />
      </div>

      {d.cohorts.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="py-2 font-semibold">Signed up the week of</th>
                <th className="py-2 font-semibold">Men</th>
                <th className="py-2 font-semibold">Next day</th>
                <th className="py-2 font-semibold">Week 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.cohorts.map((c) => (
                <tr key={c.week}>
                  <td className="py-2">{weekLabel(c.week)}</td>
                  <td className="py-2 tabular-nums">{c.signed_up}</td>
                  <td className="py-2 tabular-nums">{c.day1_eligible ? `${pct(c.day1, c.day1_eligible)} (${c.day1}/${c.day1_eligible})` : "too early"}</td>
                  <td className="py-2 tabular-nums">{c.week2_eligible ? `${pct(c.week2, c.week2_eligible)} (${c.week2}/${c.week2_eligible})` : "too early"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {first.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold">What men did first</p>
          <RankBars rows={first} unit="men" />
          <p className="mt-2 text-xs text-ink-soft">Only men who signed in and saved to their account are counted; what they did on a phone without an account can&apos;t be seen.</p>
        </div>
      )}
    </Panel>
  );
}
