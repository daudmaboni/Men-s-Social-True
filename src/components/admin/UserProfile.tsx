"use client";

// Admin → Users → one man: everything about his account and how he uses the app (Step 65).
// His private records (check-ins, sleep, water, notes, profile, topics, what he opened) appear only
// when HE has turned on "Share my records with Kayani support" — and only for owners, with a reason,
// logged in the audit log. The database enforces all of this (migration 0012); this screen just shows it.

import { useMemo, useState } from "react";
import { Copy, Eye, Lock, Smartphone } from "lucide-react";
import { Badge, ErrorBox, Loading, ago, btn, fmtDate, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { NEEDS_0006, rpc } from "@/lib/admin/api";
import { LIBRARY, TOPICS } from "@/lib/content/library";
import { listLiveCourses } from "@/lib/course/repo";
import { courseView } from "@/lib/course/progress";
import { ACTIVITIES, LESSONS } from "@/lib/feed/catalog";
import { levelFor, totalPoints } from "@/lib/feed/engine";
import type { CourseProgress, FeedDB } from "@/lib/feed/store";
import type { Goal, TrackingRecord } from "@/lib/progress/types";

/* ───────── What the database sends ───────── */
export interface Profile {
  account: {
    id: string;
    email: string | null;
    phone: string | null;
    providers: (string | null)[] | null;
    created_at: string;
    last_sign_in_at: string | null;
    confirmed_at: string | null;
    restricted_until: string | null;
    admin_role: string | null;
  };
  app: { lang: "en" | "sw" | null; platform: string | null; first_seen: string; updated_at: string } | null;
  activity: { days_total: number; days_30: number; days_7: number; last_day: string | null; days: string[] };
  synced: Record<string, { updated_at: string; bytes: number }>;
  nickname: string | null;
  discreet: boolean;
  usage: { opened: number; saved: number; topics: number; lessons: number; activity_days: number; activities_done: number; activities_skipped: number };
  course: Record<string, CourseProgress>;
  community: {
    posts: number;
    replies: number;
    reactions: number;
    reports_made: number;
    reported: number;
    hidden: number;
    items: { type: "post" | "reply"; id: string; title: string | null; body: string; topic: string | null; status: string; anonymous: boolean; created_at: string; reply_count: number }[] | null;
  };
  warnings: { message: string; created_at: string }[];
  notifications: {
    prefs: { announcements: boolean; new_content: boolean; tips: boolean; community: boolean } | null;
    received: number;
    opened: number;
    recent: { title: string; kind: string; delivered_at: string; opened_at: string | null }[];
  };
  audit: { action: string; actor_role: string | null; details: Record<string, unknown>; at: string }[] | null;
  share: { shared_at: string } | null;
  can_open_private: boolean;
}

interface Private {
  profile: { photo?: string; ageRange?: string; region?: string };
  interests: string[];
  history: Record<string, string>;
  bookmarks: Record<string, string>;
  records: TrackingRecord[];
  goals: Goal[];
  days: FeedDB["days"];
  lessons: FeedDB["lessons"];
}

const PLATFORM: Record<string, string> = { android: "Android app", ios: "iPhone app", pwa: "Home-screen app", web: "Browser" };
const PROVIDER: Record<string, string> = { email: "Email and password", google: "Google", phone: "Phone (SMS)", apple: "Apple", facebook: "Facebook" };
const AUDIT: Record<string, string> = {
  "user.restrict": "Restricted",
  "user.unrestrict": "Restriction lifted",
  "user.warn": "Warning sent",
  "user.delete": "Deleted",
  "user.private_view": "Opened his shared records",
};
const titleOf = (id: string) => LIBRARY.find((c) => c.id === id)?.title ?? id;
const topicOf = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? id;
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const kb = (b: number) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

export function UserProfile({ userId }: { userId: string }) {
  const profile = useLoad(() => rpc<Profile>("admin_user_profile", { p_user: userId }), [userId]);
  const courses = useLoad(() => listLiveCourses(), []);

  if (profile.error)
    return profile.error === NEEDS_0006 ? (
      <p className="rounded-xl bg-bg px-3 py-2 text-xs text-ink-soft">The full profile needs database update 0012. Run supabase/migrations/0012_user_profile.sql in Supabase → SQL Editor.</p>
    ) : (
      <ErrorBox error={profile.error} onRetry={profile.reload} />
    );
  if (!profile.data) return <Loading label="Loading his profile" />;
  const p = profile.data;

  return (
    <div className="space-y-6">
      <Numbers p={p} />
      <ActivityCalendar days={p.activity.days} />
      <AccountDetails p={p} />
      <Section title="Course">
        <CourseProgressList progress={p.course} courses={courses.data} />
      </Section>
      <CommunitySection c={p.community} />
      <NotificationsSection n={p.notifications} />
      {p.warnings.length > 0 && (
        <Section title={`Warnings (${p.warnings.length})`}>
          <ul className="space-y-2">
            {p.warnings.map((w, i) => (
              <li key={i} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <p>{w.message}</p>
                <p className="mt-1 text-[0.6875rem] opacity-70">{fmtDate(w.created_at, true)}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <PrivateRecords p={p} userId={userId} onOpened={profile.reload} />
      {p.audit && p.audit.length > 0 && (
        <Section title="Admin history">
          <ul className="space-y-1.5 text-xs">
            {p.audit.map((a, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="font-semibold">{AUDIT[a.action] ?? a.action}</span>
                <span className="text-ink-soft">
                  {a.actor_role ? `by ${a.actor_role} · ` : ""}
                  {fmtDate(a.at, true)}
                </span>
                {typeof a.details?.reason === "string" && <span className="w-full text-ink-soft">“{a.details.reason}”</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

/* ───────── Pieces ───────── */
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold">{title}</h3>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-bg px-3 py-2.5">
      <p className="text-[0.6875rem] text-ink-soft">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight">{value}</p>
      {hint && <p className="text-[0.6875rem] text-ink-soft">{hint}</p>}
    </div>
  );
}

function Numbers({ p }: { p: Profile }) {
  const courseDone = Object.values(p.course).filter((c) => c.done).length;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Tile label="Days active" value={p.activity.days_total} hint={`${p.activity.days_30} in last 30 · ${p.activity.days_7} in last 7`} />
      <Tile label="Last active" value={p.activity.last_day ? fmtDate(p.activity.last_day) : "—"} hint={`Signed in ${ago(p.account.last_sign_in_at)}`} />
      <Tile label="Content" value={p.usage.opened} hint={`opened · ${p.usage.saved} saved`} />
      <Tile label="Lessons" value={p.usage.lessons + courseDone} hint={`${courseDone} course · ${p.usage.lessons} feed`} />
      <Tile label="Daily activities" value={p.usage.activities_done} hint={`done · ${p.usage.activities_skipped} skipped`} />
      <Tile label="Days with activities" value={p.usage.activity_days} />
      <Tile label="Community" value={p.community.posts + p.community.replies} hint={`${p.community.posts} posts · ${p.community.replies} replies`} />
      <Tile label="Topics followed" value={p.usage.topics} hint={p.share ? "names under records" : "names private"} />
    </div>
  );
}

/** The last 120 days, one square per day, darker = he opened the app. */
function ActivityCalendar({ days }: { days: string[] }) {
  const set = useMemo(() => new Set(days), [days]);
  const cells = useMemo(() => {
    const out: { key: string; on: boolean }[] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 119 - ((today.getDay() + 6) % 7)); // start on a Monday
    for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      out.push({ key, on: set.has(key) });
    }
    return out;
  }, [set]);
  return (
    <Section title="When he used the app" sub="Last 4 months. Each square is a day; green = he opened the app.">
      <div className="grid grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto pb-1" role="img" aria-label={`Active on ${days.length} of the last 120 days`}>
        {cells.map((c) => (
          <span key={c.key} title={`${fmtDate(c.key)}${c.on ? " · active" : ""}`} className={`h-3 w-3 rounded-[3px] ${c.on ? "bg-forest" : "bg-line/70"}`} />
        ))}
      </div>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-ink-soft">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

function AccountDetails({ p }: { p: Profile }) {
  const showToast = useToast();
  const a = p.account;
  const providers = (a.providers ?? []).filter(Boolean).map((x) => PROVIDER[x as string] ?? x);
  return (
    <Section title="Account">
      <dl className="divide-y divide-line rounded-xl bg-bg px-3">
        <Row label="Name in Community">{p.nickname ?? <span className="text-ink-soft">Not set</span>}</Row>
        <Row label="Email">{a.email ?? "—"}</Row>
        {a.phone && <Row label="Phone">{a.phone}</Row>}
        <Row label="Signs in with">{providers.length ? providers.join(", ") : "—"}</Row>
        <Row label="Joined">{fmtDate(a.created_at, true)}</Row>
        <Row label="Email confirmed">{a.confirmed_at ? fmtDate(a.confirmed_at) : "Not yet"}</Row>
        <Row label="Last sign-in">{fmtDate(a.last_sign_in_at, true)}</Row>
        <Row label="Reads in">{p.app?.lang ? (p.app.lang === "sw" ? "Kiswahili" : "English") : <span className="text-ink-soft">Not known yet</span>}</Row>
        <Row label="Uses">
          {p.app?.platform ? (
            <span className="inline-flex items-center gap-1">
              <Smartphone size={13} /> {PLATFORM[p.app.platform] ?? p.app.platform}
            </span>
          ) : (
            <span className="text-ink-soft">Not known yet</span>
          )}
        </Row>
        <Row label="Discreet mode">{p.discreet ? "On" : "Off"}</Row>
        <Row label="Saved to his account">
          {Object.keys(p.synced).length ? (
            <span className="block space-y-0.5 text-xs">
              {Object.entries(p.synced).map(([k, v]) => (
                <span key={k} className="block">
                  {k === "progress" ? "Trackers" : k === "feed" ? "Activities & lessons" : "Social & profile"}: {kb(v.bytes)} · {ago(v.updated_at)}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-ink-soft">Nothing yet</span>
          )}
        </Row>
        <Row label="Account id">
          <button
            className="inline-flex items-center gap-1 font-mono text-[0.6875rem] text-ink-soft hover:text-ink"
            onClick={() => {
              void navigator.clipboard?.writeText(a.id);
              showToast("Account id copied");
            }}
          >
            {a.id.slice(0, 8)}… <Copy size={11} />
          </button>
        </Row>
      </dl>
    </Section>
  );
}

function CourseProgressList({ progress, courses }: { progress: Record<string, CourseProgress>; courses: Awaited<ReturnType<typeof listLiveCourses>> | null }) {
  if (!Object.keys(progress).length) return <p className="text-xs text-ink-soft">Hasn&apos;t started a course yet.</p>;
  if (!courses) return <p className="text-xs text-ink-soft">Loading courses…</p>;
  const last = Object.values(progress).reduce((m, c) => (c.at > m ? c.at : m), "");
  const heardMin = Math.round(Object.values(progress).reduce((s, c) => s + (c.heard || 0), 0) / 60);
  return (
    <div className="space-y-2">
      {courses.map((c) => {
        const v = courseView(c, progress);
        if (!v.lessons.some((l) => l.progress)) return null;
        return (
          <div key={c.id} className="rounded-xl bg-bg px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{c.title}</p>
              {v.finished ? <Badge tone="good">Finished</Badge> : <span className="text-xs font-bold tabular-nums">{v.percent}%</span>}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-forest" style={{ width: `${v.percent}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">
              {v.done} of {v.total} lessons{v.current ? ` · now on ${v.current.code} ${v.current.title}` : ""}
            </p>
          </div>
        );
      })}
      <p className="text-[0.6875rem] text-ink-soft">
        Listened about {heardMin} min in total · last listened {ago(last)}
      </p>
    </div>
  );
}

function CommunitySection({ c }: { c: Profile["community"] }) {
  return (
    <Section title="Community">
      <p className="text-xs text-ink-soft">
        {c.posts} posts · {c.replies} replies · {c.reactions} reactions · reported others {c.reports_made}× · reported by others {c.reported}×
        {c.hidden ? ` · ${c.hidden} hidden by moderators` : ""}
      </p>
      {c.items === null ? (
        <p className="mt-2 text-xs text-ink-soft">Moderators and owners can read what he wrote here.</p>
      ) : c.items.length ? (
        <ul className="mt-2 space-y-2">
          {c.items.map((x) => (
            <li key={x.id} className="rounded-xl bg-bg px-3 py-2">
              <p className="text-[0.6875rem] text-ink-soft">
                {x.type === "post" ? "Post" : `Reply to “${x.title ?? "a post"}”`} · {fmtDate(x.created_at)}
                {x.anonymous ? " · anonymous" : ""}
                {x.status !== "visible" ? ` · ${x.status}` : ""}
                {x.type === "post" ? ` · ${x.reply_count} replies` : ""}
              </p>
              {x.type === "post" && <p className="font-semibold">{x.title}</p>}
              {x.body && <p className="line-clamp-3 whitespace-pre-line text-sm">{x.body}</p>}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function NotificationsSection({ n }: { n: Profile["notifications"] }) {
  const prefs = n.prefs ?? { announcements: true, new_content: true, tips: true, community: true };
  return (
    <Section title="Messages from the app">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["announcements", "News"],
            ["new_content", "New content"],
            ["tips", "Tips"],
            ["community", "Community"],
          ] as const
        ).map(([k, label]) => (
          <Badge key={k} tone={prefs[k] ? "good" : "neutral"}>
            {label}: {prefs[k] ? "on" : "off"}
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {n.received} received · {n.opened} opened{n.received ? ` (${Math.round((n.opened / n.received) * 100)}%)` : ""}
      </p>
      {n.recent.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {n.recent.map((r, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate">{r.title}</span>
              <span className="shrink-0 text-ink-soft">{r.opened_at ? "opened" : "not opened"} · {fmtDate(r.delivered_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ───────── His shared records ───────── */
function PrivateRecords({ p, userId, onOpened }: { p: Profile; userId: string; onOpened: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Private | null>(null);

  if (!p.share)
    return (
      <Section title="His records">
        <p className="flex items-start gap-2 rounded-xl bg-bg px-3 py-2.5 text-xs text-ink-soft">
          <Lock size={14} className="mt-0.5 shrink-0 text-forest" />
          Private. His check-ins, sleep, water, notes, profile, topics and the content he opened stay hidden until he turns on “Share my records
          with Kayani support” in Me → Settings. If he needs help, ask him to turn it on.
        </p>
      </Section>
    );
  if (!p.can_open_private)
    return (
      <Section title="His records" sub={`He shares them with support since ${fmtDate(p.share.shared_at)}.`}>
        <p className="text-xs text-ink-soft">Only an owner can open them.</p>
      </Section>
    );
  if (!data)
    return (
      <Section title="His records" sub={`He chose to share them with support on ${fmtDate(p.share.shared_at)}. Each time you open them it's written in the audit log.`}>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              setData(await rpc<Private>("admin_user_private", { p_user: userId, p_reason: reason.trim() }));
              onOpened();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={input} placeholder="Why? e.g. He asked for help with his sleep" aria-label="Reason" />
          <button className={`${btn.primary} shrink-0`} disabled={busy || reason.trim().length < 5}>
            <Eye size={14} /> {busy ? "Opening…" : "Open his records"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </Section>
    );
  return <RecordsView d={data} />;
}

function RecordsView({ d }: { d: Private }) {
  const by = (m: TrackingRecord["metric"]) => d.records.filter((r) => r.metric === m).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const water = by("water");
  const sleep = by("sleep");
  const checkins = useMemo(() => {
    const map = new Map<string, { energy?: number; mood?: number; notes: string[] }>();
    for (const r of d.records.filter((x) => x.metric === "energy" || x.metric === "mood")) {
      const e = map.get(r.localDate) ?? { notes: [] };
      e[r.metric as "energy" | "mood"] = r.value;
      if (r.note) e.notes.push(r.note);
      map.set(r.localDate, e);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [d.records]);
  const waterDays = useMemo(() => {
    const map = new Map<string, number>();
    water.forEach((r) => map.set(r.localDate, (map.get(r.localDate) ?? 0) + r.value));
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [water]);
  const feed: FeedDB = { days: d.days, lessons: d.lessons, settings: { discreet: false } };
  const points = totalPoints(ACTIVITIES, LESSONS, feed, d.records, d.goals);
  const lvl = levelFor(points);
  const goal = (m: string) => d.goals.find((g) => g.metric === m)?.target;
  const notes = d.records.filter((r) => r.note);
  const list = (o: Record<string, string>) => Object.entries(o).sort((a, b) => b[1].localeCompare(a[1]));
  const actTitle = (id: string) => ACTIVITIES.find((a) => a.id === id)?.title ?? id;

  return (
    <div className="space-y-5 rounded-2xl p-3 ring-2 ring-forest/30">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-forest">Shared by him · opening logged</p>
      <div className="flex items-center gap-3">
        {d.profile.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.profile.photo} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-ink-soft">—</span>
        )}
        <div className="text-sm">
          <p>Age: {d.profile.ageRange ?? "not given"}</p>
          <p>Region: {d.profile.region ?? "not given"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Points" value={points} hint={`Level ${lvl.level}`} />
        <Tile label="Water goal" value={goal("water") ? `${(goal("water")! / 1000).toFixed(1)} L` : "—"} />
        <Tile label="Sleep goal" value={goal("sleep") ? `${Math.floor(goal("sleep")! / 60)}h${goal("sleep")! % 60 ? ` ${goal("sleep")! % 60}m` : ""}` : "—"} />
        <Tile label="Records" value={d.records.length} hint={`${checkins.length} check-in days`} />
      </div>
      <Section title="Topics he follows">
        <p className="text-sm">{d.interests.length ? d.interests.map(topicOf).join(", ") : <span className="text-ink-soft">None chosen</span>}</p>
      </Section>
      <Section title="Check-ins (energy and mood, 1–5)">
        {checkins.length ? (
          <ul className="space-y-1 text-xs">
            {checkins.slice(0, 30).map(([day, c]) => (
              <li key={day} className="flex gap-3">
                <span className="w-24 shrink-0 text-ink-soft">{fmtDate(day)}</span>
                <span>
                  Energy {c.energy ?? "—"} · Mood {c.mood ?? "—"}
                  {c.notes.length ? <span className="block text-ink-soft">“{c.notes.join(" · ")}”</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-soft">None yet.</p>
        )}
      </Section>
      <Section title="Sleep">
        {sleep.length ? (
          <ul className="space-y-1 text-xs">
            {sleep.slice(0, 20).map((r) => (
              <li key={r.id} className="flex gap-3">
                <span className="w-24 shrink-0 text-ink-soft">{fmtDate(r.localDate)}</span>
                <span>
                  {Math.floor(r.value / 60)}h {r.value % 60}m
                  {r.meta?.quality ? ` · quality ${r.meta.quality}/5` : ""}
                  {r.meta?.startAt && r.meta?.endAt ? ` · ${hm(r.meta.startAt)}–${hm(r.meta.endAt)}` : r.meta?.bedtime ? ` · ${r.meta.bedtime}–${r.meta.wakeTime ?? "?"}` : ""}
                  {r.meta?.status === "estimated" ? " · estimated by phone" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-soft">None yet.</p>
        )}
      </Section>
      <Section title="Water (per day)">
        {waterDays.length ? (
          <ul className="space-y-1 text-xs">
            {waterDays.slice(0, 20).map(([day, ml]) => (
              <li key={day} className="flex gap-3">
                <span className="w-24 shrink-0 text-ink-soft">{fmtDate(day)}</span>
                <span>
                  {(ml / 1000).toFixed(2)} L{goal("water") && ml >= goal("water")! ? " · goal reached" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-soft">None yet.</p>
        )}
      </Section>
      {notes.length > 0 && (
        <Section title="His notes">
          <ul className="space-y-1.5 text-sm">
            {notes.slice(0, 30).map((r) => (
              <li key={r.id} className="rounded-xl bg-bg px-3 py-2">
                {r.note}
                <span className="mt-0.5 block text-[0.6875rem] text-ink-soft">
                  {r.metric} · {fmtDate(r.recordedAt, true)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Daily activities">
        {Object.keys(d.days).length ? (
          <ul className="space-y-1 text-xs">
            {Object.entries(d.days)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .slice(0, 20)
              .map(([day, acts]) => (
                <li key={day} className="flex gap-3">
                  <span className="w-24 shrink-0 text-ink-soft">{fmtDate(day)}</span>
                  <span>
                    {Object.entries(acts)
                      .map(([id, a]) => `${actTitle(id)} (${a.status})`)
                      .join(" · ")}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-soft">None yet.</p>
        )}
      </Section>
      <Section title={`Content he opened (${Object.keys(d.history).length})`}>
        <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
          {list(d.history).map(([id, at]) => (
            <li key={id} className="flex justify-between gap-3">
              <span className="truncate">{titleOf(id)}</span>
              <span className="shrink-0 text-ink-soft">{fmtDate(at)}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Saved (${Object.keys(d.bookmarks).length})`}>
        <ul className="space-y-1 text-xs">
          {list(d.bookmarks).map(([id, at]) => (
            <li key={id} className="flex justify-between gap-3">
              <span className="truncate">{titleOf(id)}</span>
              <span className="shrink-0 text-ink-soft">{fmtDate(at)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
