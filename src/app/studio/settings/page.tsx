"use client";

// Admin → Settings: profile, appearance, admins and roles, feature switches, system health,
// security (sessions) and the audit log. Owner-only actions are refused by the database for other roles.

import { leaveTo } from "@/lib/ui/leave";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleDashed, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Appearance, useStudio } from "@/components/admin/AdminShell";
import { Badge, Confirm, Empty, ErrorBox, Loading, PageHeader, Panel, ago, btn, downloadCsv, fmtDate, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { rpc, select } from "@/lib/admin/api";
import { actionArea, actionLabel } from "@/lib/admin/audit";
import { ROLES, type AdminRole } from "@/lib/admin/perms";
import { getContentRepo } from "@/lib/content/repo";
import { getSupabase } from "@/lib/supabase/client";
import { staffName } from "@/lib/studio/username";
import PasswordMeter from "@/components/security/PasswordMeter";
import { checkPassword } from "@/lib/security/password";

type Tab = "profile" | "admins" | "features" | "health" | "audit" | "security";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile & appearance" },
  { id: "admins", label: "Admins & roles" },
  { id: "features", label: "Features" },
  { id: "health", label: "System health" },
  { id: "audit", label: "Audit log" },
  { id: "security", label: "Security & data" },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const t = (params.get("tab") as Tab) || "profile";
  const tab = TABS.some((x) => x.id === t) ? t : "profile";
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" />
      <div className="flex gap-1 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-line [scrollbar-width:none]" role="tablist" aria-label="Settings sections">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => router.replace(`/studio/settings?tab=${x.id}`, { scroll: false })}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${tab === x.id ? "bg-forest-deep text-white" : "text-ink-soft"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === "profile" && <Profile />}
      {tab === "admins" && <Admins />}
      {tab === "features" && <Features />}
      {tab === "health" && <Health />}
      {tab === "audit" && <Audit />}
      {tab === "security" && <Security />}
    </div>
  );
}

function Profile() {
  const studio = useStudio();
  const showToast = useToast();
  const [name, setName] = useState(studio.admin.displayName ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const role = ROLES.find((r) => r.id === studio.admin.role);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel title="Your profile">
        <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-ink-soft">Sign-in</dt>
            <dd>{staffName(studio.admin.email)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Role</dt>
            <dd>{role?.label}</dd>
          </div>
          <div className="col-span-2 text-xs text-ink-soft">{role?.about}</div>
        </dl>
        <label className="block text-xs font-semibold text-ink-soft">
          Display name (shown in the sidebar)
          <div className="mt-1 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={`${input} font-normal text-ink`} placeholder={staffName(studio.admin.email)} />
            <button
              className={btn.primary}
              disabled={busy !== null}
              onClick={async () => {
                setBusy("name");
                setError(null);
                try {
                  await rpc("admin_set_display_name", { p_name: name });
                  studio.refresh();
                  showToast("Name saved");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              Save
            </button>
          </div>
        </label>
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold text-ink-soft">Change password</p>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (at least 12 characters)" className={input} aria-label="New password" />
          <PasswordMeter password={pw} email={studio.admin.email} minLength={12} />
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Type it again" className={input} aria-label="Repeat new password" />
          <button
            className={btn.ghost}
            disabled={busy !== null || !checkPassword(pw, { email: studio.admin.email, minLength: 12 }).ok || pw !== pw2}
            onClick={async () => {
              setBusy("pw");
              setError(null);
              const { error } = (await getSupabase()?.auth.updateUser({ password: pw })) ?? { error: { message: "Supabase isn't connected" } };
              setBusy(null);
              if (error) return setError(error.message);
              setPw("");
              setPw2("");
              showToast("Password changed");
            }}
          >
            {busy === "pw" && <Loader2 size={14} className="animate-spin" />} Change password
          </button>
          {pw && pw2 && pw !== pw2 && <p className="text-xs text-red-700">The two passwords don&apos;t match.</p>}
        </div>
        {error && (
          <div className="mt-3">
            <ErrorBox error={error} />
          </div>
        )}
      </Panel>
      <Panel title="Appearance" sub="Light, dark or automatic, and the colour. Shared with the men's app on this device.">
        <div className="max-w-xs">
          <Appearance />
        </div>
      </Panel>
    </div>
  );
}

type AdminRow = { user_id: string; email: string | null; role: AdminRole; display_name: string | null; created_at: string; last_sign_in_at: string | null; me: boolean };

function Admins() {
  const studio = useStudio();
  const showToast = useToast();
  const list = useLoad(() => rpc<AdminRow[]>("admin_list"), []);
  const owner = studio.can("admins.manage");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("writer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<AdminRow | null>(null);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      showToast(done);
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Admins" sub={owner ? "Add, change or remove admins. There's always at least one owner." : "Only owners can change admins."}>
        {error && (
          <div className="mb-3">
            <ErrorBox error={error} />
          </div>
        )}
        {owner && (
          <div className="mb-4 flex flex-wrap gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their account email (or username@studio.menssocial.app)" className={`${input} min-w-60 flex-1`} aria-label="Email of the new admin" />
            <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)} className={`${input} w-36`} aria-label="Role">
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <button className={btn.primary} disabled={busy || !/.+@.+\..+/.test(email)} onClick={() => run(() => rpc("admin_add", { p_email: email.trim(), p_role: role }), "Admin added").then(() => setEmail(""))}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}
        {list.error ? (
          <ErrorBox error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <Loading />
        ) : (
          <ul className="divide-y divide-line">
            {list.data.map((a) => (
              <li key={a.user_id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest-deep">{(a.display_name || staffName(a.email ?? "?")).slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {a.display_name || staffName(a.email ?? "—")} {a.me && <Badge>You</Badge>}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">
                    {a.email} · last sign-in {ago(a.last_sign_in_at)}
                  </span>
                </span>
                {owner ? (
                  <select value={a.role} disabled={busy} onChange={(e) => run(() => rpc("admin_set_role", { p_user: a.user_id, p_role: e.target.value }), "Role changed")} className={`${input} w-32 py-1.5`} aria-label={`Role of ${a.email}`}>
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge>{ROLES.find((r) => r.id === a.role)?.label}</Badge>
                )}
                {owner && !a.me && (
                  <button aria-label={`Remove ${a.email} as admin`} onClick={() => setRemoving(a)} className="text-ink-soft hover:text-red-700">
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="What each role can do">
        <ul className="space-y-3 text-sm">
          {ROLES.map((r) => (
            <li key={r.id}>
              <p className="font-semibold">{r.label}</p>
              <p className="text-xs text-ink-soft">{r.about}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.6875rem] text-ink-soft">The database enforces these roles. Hiding a button is only a convenience.</p>
      </Panel>
      <Confirm
        open={removing !== null}
        title="Remove this admin?"
        confirmLabel="Remove admin"
        danger
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={() => void run(() => rpc("admin_remove", { p_user: removing!.user_id }), "Admin removed").then(() => setRemoving(null))}
      >
        {removing?.email} loses access to the Control Center straight away. Their account isn&apos;t deleted.
      </Confirm>
    </div>
  );
}

type Setting = { key: string; value: unknown; updated_at: string };

function Features() {
  const studio = useStudio();
  const showToast = useToast();
  const list = useLoad(() => select<Setting>("app_settings", "key,value,updated_at"), []);
  const [confirm, setConfirm] = useState<{ key: string; label: string; value: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = studio.can("settings.manage");
  const get = (k: string) => list.data?.find((s) => s.key === k)?.value;
  const ai = (get("ai_config") as { enabled?: boolean } | undefined) ?? {};
  // Kito usage, totals only (0013); quietly empty before the update
  const kito = useLoad(() => rpc<{ questions: number; men: number; answered: number; not_in_library: number }>("admin_kito_stats", { p_days: 30 }).catch(() => null), []);
  const switches = [
    { key: "community_enabled", label: "Community", on: get("community_enabled") !== false, about: "Off = men see “Community is paused”; nobody can post. Posts are kept." },
    { key: "notifications_enabled", label: "In-app notifications", on: get("notifications_enabled") !== false, about: "Off = inboxes show nothing new. Scheduled messages wait." },
    { key: "ai_config", label: "AI assistant", on: Boolean(ai.enabled), about: "Lets editors and writers use AI drafting (needs the server key)." },
    {
      key: "kito_enabled",
      label: "Kito (members' assistant)",
      on: get("kito_enabled") !== false,
      about: `Answers men's questions from the published library and links the guides it used. Separate from staff AI. Needs database update 0013 and the server key.${
        kito.data ? ` Last 30 days: ${kito.data.questions} questions from ${kito.data.men} men · ${kito.data.answered} answered from the library · ${kito.data.not_in_library} not in the library.` : ""
      }`,
    },
  ];

  return (
    <Panel title="Features" sub={owner ? "Switch parts of the app on or off for everyone. Changes are logged." : "Only owners can change these."}>
      {error && <ErrorBox error={error} />}
      {list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-line">
          {switches.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className="block text-xs text-ink-soft">{s.about}</span>
              </span>
              <button
                role="switch"
                aria-checked={s.on}
                aria-label={s.label}
                disabled={!owner || busy}
                onClick={() => setConfirm({ key: s.key, label: s.label, value: s.key === "ai_config" ? { ...(get("ai_config") as object), enabled: !s.on } : !s.on })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.on ? "bg-forest" : "bg-line"}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${s.on ? "left-6" : "left-1"}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Confirm
        open={confirm !== null}
        title={`Switch ${confirm?.label} ${(typeof confirm?.value === "boolean" ? confirm.value : (confirm?.value as { enabled: boolean })?.enabled) ? "on" : "off"}?`}
        confirmLabel="Confirm"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setBusy(true);
          setError(null);
          try {
            await rpc("settings_set", { p_key: confirm!.key, p_value: confirm!.value });
            showToast("Saved");
            list.reload();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
            setConfirm(null);
          }
        }}
      >
        This changes it for every man using the app.
      </Confirm>
    </Panel>
  );
}

type Health = { schema_version: unknown; database_time: string; buckets: string[]; content_rows: number; admins: number; owners: number; audit_rows: number };

function Health() {
  const h = useLoad(async () => {
    const t0 = performance.now();
    const health = await rpc<Health>("admin_health");
    const ms = Math.round(performance.now() - t0);
    const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
    const ai = await fetch("/api/ai", { headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` } })
      .then((r) => r.json())
      .catch(() => ({ error: "API route not reachable" }));
    const content = await getContentRepo()
      .listAll()
      .then(() => "ok")
      .catch((e: Error) => e.message);
    return { health, ms, ai, content };
  }, []);

  if (h.error) return <ErrorBox error={h.error} onRetry={h.reload} />;
  if (!h.data) return <Loading label="Checking" />;
  const { health, ms, ai, content } = h.data;
  const need = ["content-audio", "content-images", "content-videos"];
  type Row = { label: string; state: "ok" | "warn" | "off"; text: string };
  const rows: Row[] = [
    { label: "Database (Supabase)", state: "ok", text: `Connected · answered in ${ms} ms · ${fmtDate(health.database_time, true)}` },
    { label: "Database update", state: String(health.schema_version) === "6" ? "ok" : "warn", text: `Version ${String(health.schema_version)} (this app expects 6)` },
    { label: "Content", state: content === "ok" ? "ok" : "warn", text: content === "ok" ? `${health.content_rows} Studio items readable` : content },
    ...need.map((b) => ({ label: `Storage: ${b}`, state: (health.buckets.includes(b) ? "ok" : "warn") as Row["state"], text: health.buckets.includes(b) ? "Ready" : "Missing — run the migrations" })),
    { label: "Owners", state: health.owners > 0 ? "ok" : "warn", text: `${health.owners} owner(s), ${health.admins} admin(s) in total` },
    { label: "Audit log", state: "ok", text: `${health.audit_rows} actions recorded` },
    { label: "AI service", state: ai.error ? "warn" : ai.configured ? (ai.enabled ? "ok" : "off") : "off", text: ai.error ? ai.error : ai.configured ? (ai.enabled ? `Connected (${ai.model})` : "Key set, switched off") : "Not connected (no server key)" },
    { label: "Phone push notifications", state: "off", text: "Not connected — in-app inbox works; lock-screen push needs a push service" },
    { label: "Phone (SMS) sign-in", state: process.env.NEXT_PUBLIC_AUTH_PHONE === "on" ? "ok" : "off", text: process.env.NEXT_PUBLIC_AUTH_PHONE === "on" ? "Switched on" : "Not connected — waiting for an SMS provider" },
    { label: "Google sign-in", state: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "on" ? "ok" : "off", text: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "on" ? "Switched on" : "Off" },
    { label: "Background jobs", state: "ok", text: "None needed: scheduled content and messages are checked each time the app asks, so nothing can silently fail" },
    { label: "Backups", state: "off", text: "Can't be checked from here — see Supabase → Database → Backups (the free plan has no automatic backups)" },
  ];
  const Icon = ({ s }: { s: Row["state"] }) => (s === "ok" ? <CheckCircle2 size={16} className="text-forest" /> : s === "warn" ? <CircleAlert size={16} className="text-amber-600" /> : <CircleDashed size={16} className="text-ink-soft" />);
  return (
    <Panel title="System health" sub="Live checks. Secrets are never shown." actions={<button className={btn.small} onClick={h.reload}>Check again</button>}>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 py-2.5 text-sm">
            <Icon s={r.state} />
            <span className="w-48 shrink-0 font-medium">{r.label}</span>
            <span className="text-ink-soft">{r.text}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

type AuditRow = { id: number; actor: string | null; actor_role: string | null; action: string; target: string | null; details: Record<string, unknown>; at: string };

function Audit() {
  const studio = useStudio();
  const list = useLoad(() => (studio.can("audit.view") ? select<AuditRow>("admin_audit", "id,actor,actor_role,action,target,details,at", (q) => q.order("at", { ascending: false }).limit(500)) : Promise.resolve(null)), [studio]);
  const admins = useLoad(() => rpc<AdminRow[]>("admin_list").catch(() => [] as AdminRow[]), []);
  const [area, setArea] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  if (!studio.can("audit.view")) return <Panel title="Audit log"><p className="text-sm text-ink-soft">Your role can&apos;t see the audit log.</p></Panel>;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;
  const who = (id: string | null) => {
    const a = admins.data?.find((x) => x.user_id === id);
    return a ? a.display_name || staffName(a.email ?? "") : id ? "Former admin" : "System";
  };
  const areas = ["all", ...new Set(list.data.map((a) => actionArea(a.action)))];
  const rows = list.data.filter((a) => (area === "all" || actionArea(a.action) === area) && (!q || `${actionLabel(a.action)} ${a.target ?? ""} ${JSON.stringify(a.details)} ${who(a.actor)}`.toLowerCase().includes(q.toLowerCase())));
  const pageRows = rows.slice(page * 50, page * 50 + 50);
  return (
    <Panel
      title="Audit log"
      sub="Every important admin action: publishing, homepage changes, moderation, user access, settings. Passwords and keys are never recorded."
      actions={<button className={btn.small} onClick={() => downloadCsv("audit-log", rows.map((a) => ({ at: a.at, who: who(a.actor), role: a.actor_role, action: actionLabel(a.action), target: a.target, details: a.details })))}>Export CSV</button>}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={area} onChange={(e) => (setArea(e.target.value), setPage(0))} className={`${input} w-40`} aria-label="Area">
          {areas.map((a) => (
            <option key={a} value={a}>
              {a === "all" ? "All areas" : a[0].toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl bg-bg px-3 ring-1 ring-line">
          <Search size={14} className="text-ink-soft" />
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder="Search" className="w-full bg-transparent py-2 text-sm outline-none" aria-label="Search the audit log" />
        </label>
      </div>
      {rows.length === 0 ? (
        <Empty title="Nothing recorded yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs text-ink-soft">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-semibold">When</th>
                <th className="py-2 pr-3 font-semibold">Who</th>
                <th className="py-2 pr-3 font-semibold">What</th>
                <th className="py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pageRows.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-ink-soft">{fmtDate(a.at, true)}</td>
                  <td className="py-2 pr-3 text-xs">
                    {who(a.actor)} <span className="text-ink-soft">({a.actor_role})</span>
                  </td>
                  <td className="py-2 pr-3">{actionLabel(a.action)}</td>
                  <td className="max-w-xs truncate py-2 text-xs text-ink-soft" title={JSON.stringify(a.details)}>
                    {[typeof a.details?.title === "string" ? a.details.title : null, typeof a.details?.reason === "string" ? a.details.reason : null, typeof a.details?.note === "string" ? a.details.note : null, a.target].filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
        <span>{rows.length} actions (latest 500 loaded)</span>
        <span className="flex gap-2">
          <button className={btn.small} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button className={btn.small} disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </span>
      </div>
    </Panel>
  );
}

function Security() {
  const session = useLoad(async () => (await getSupabase()?.auth.getSession())?.data.session ?? null, []);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel title="Your session">
        {session.data ? (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-ink-soft">Signed in as</dt>
              <dd>{staffName(session.data.user.email ?? "")}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-soft">This sign-in renews automatically until</dt>
              <dd>{session.data.expires_at ? fmtDate(new Date(session.data.expires_at * 1000).toISOString(), true) : "—"} (then refreshes while you&apos;re active)</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-ink-soft">{session.error ?? "Loading…"}</p>
        )}
        <button className={`${btn.ghost} mt-4`} onClick={() => setConfirm(true)}>
          Sign out on all devices
        </button>
        <p className="mt-2 text-[0.6875rem] text-ink-soft">Use this if a phone or computer with your admin login was lost or shared.</p>
      </Panel>
      <Panel title="Privacy and data">
        <ul className="space-y-2 text-sm text-ink-soft">
          <li>• Admins never see men&apos;s check-ins, sleep, water, private notes or profile details (the database blocks it).</li>
          <li>• Views and searches are counted without linking them to anyone. Topic counts under 5 men are hidden.</li>
          <li>• Emails are masked for editors, writers and analysts; owners and moderators see them for support and safety.</li>
          <li>• A man can download or delete his own data on Me. For deletion requests by message, use Users → Delete account (owners).</li>
          <li>• Every admin action is in the audit log. Secrets (passwords, API keys) are never stored in the database or shown here.</li>
        </ul>
      </Panel>
      <Confirm
        open={confirm}
        title="Sign out everywhere?"
        confirmLabel="Sign out everywhere"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await leaveTo("/", async () => {
            await getSupabase()?.auth.signOut({ scope: "global" });
          });
        }}
      >
        You&apos;ll need to sign in again here and on any other device.
      </Confirm>
    </div>
  );
}
