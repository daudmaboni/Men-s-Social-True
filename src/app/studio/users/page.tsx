"use client";

// Admin → Users: find accounts, see engagement (never health records), add support notes,
// warn, restrict or delete. Every action is checked and logged by the database.

import { useEffect, useState } from "react";
import { Ban, MessageSquareWarning, Search, ShieldCheck, StickyNote, Trash2, UserCheck } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { RankBars } from "@/components/admin/Chart";
import { Badge, Confirm, Drawer, Empty, ErrorBox, Loading, PageHeader, Panel, Segmented, ago, btn, downloadCsv, fmtDate, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { db, rpc } from "@/lib/admin/api";
import { TOPICS } from "@/lib/content/library";

type U = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_active: string | null;
  restricted_until: string | null;
  onboarded: boolean;
  opened: number;
  saved: number;
  lessons: number;
  posts: number;
  admin_role: string | null;
  notes: number;
  warnings: number;
  total: number;
};
type Note = { id: number; body: string; created_at: string; author: string | null };
type Adoption = { synced_users: number; water: number; sleep: number; checkin: number; activities: number; lessons: number; saved: number; topics_followed: Record<string, number | null>; min_group: number };
type Filter = "all" | "new7" | "active30" | "inactive30" | "restricted" | "admins";
const PAGE = 25;

export default function UsersPage() {
  const studio = useStudio();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [picked, setOpen] = useState<U | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [search, filter]);

  const list = useLoad(() => rpc<U[]>("admin_users", { p_search: search, p_filter: filter, p_limit: PAGE, p_offset: page * PAGE }), [search, filter, page]);
  // After an action the list reloads; show the fresh row so the drawer reflects it (e.g. Restrict → Lift restriction).
  const open = picked ? (list.data?.find((x) => x.id === picked.id) ?? picked) : null;
  const adoption = useLoad(() => rpc<Adoption>("admin_adoption"), []);
  const total = list.data?.[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        sub="Accounts and how they use the app. Check-ins, sleep, water, notes and profile details stay private — they aren't shown here."
        actions={
          list.data?.length ? (
            <button
              className={btn.ghost}
              onClick={() =>
                downloadCsv(
                  "users",
                  list.data!.map((u) => ({ email: u.email, joined: u.created_at, last_active: u.last_active, onboarded: u.onboarded, opened: u.opened, saved: u.saved, lessons: u.lessons, posts: u.posts, restricted_until: u.restricted_until, admin: u.admin_role })),
                )
              }
            >
              Export this page
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-forest">
          <Search size={14} className="text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or account id" aria-label="Search users" className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </label>
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: "All" },
            { id: "new7", label: "New (7 days)" },
            { id: "active30", label: "Active (30 d)" },
            { id: "inactive30", label: "Inactive" },
            { id: "restricted", label: "Restricted" },
            { id: "admins", label: "Admins" },
          ]}
        />
      </div>

      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {!list.data && list.loading && <Loading />}
      {list.data && (
        <div className={`overflow-x-auto rounded-2xl bg-surface ring-1 ring-line ${list.loading ? "opacity-60" : ""}`}>
          {list.data.length === 0 ? (
            <Empty title="No accounts match">Try another search or filter.</Empty>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-ink-soft">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-semibold">Account</th>
                  <th className="px-3 py-2.5 font-semibold">Joined</th>
                  <th className="px-3 py-2.5 font-semibold">Last active</th>
                  <th className="px-3 py-2.5 font-semibold" title="Content opened · saved · lessons read · community posts">Engagement</th>
                  <th className="px-3 py-2.5 font-semibold">Set up</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.data.map((u) => (
                  <tr key={u.id} className="cursor-pointer hover:bg-bg" onClick={() => setOpen(u)}>
                    <td className="px-4 py-2.5">
                      <button className="text-left font-medium hover:underline" onClick={() => setOpen(u)}>
                        {u.email ?? "(phone account)"}
                      </button>
                      {u.notes > 0 && (
                        <span className="ml-2 text-[11px] text-ink-soft">
                          <StickyNote size={11} className="inline" /> {u.notes}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{u.last_active ? fmtDate(u.last_active) : u.last_sign_in_at ? `Signed in ${ago(u.last_sign_in_at)}` : "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">
                      {u.opened} · {u.saved} · {u.lessons} · {u.posts}
                    </td>
                    <td className="px-3 py-2.5">{u.onboarded ? <Badge tone="good">Yes</Badge> : <Badge>Not yet</Badge>}</td>
                    <td className="space-x-1 px-3 py-2.5">
                      {u.admin_role && <Badge tone="info">Admin · {u.admin_role}</Badge>}
                      {u.restricted_until && <Badge tone="bad">Restricted to {fmtDate(u.restricted_until)}</Badge>}
                      {u.warnings > 0 && <Badge tone="warn">{u.warnings} warning{u.warnings > 1 ? "s" : ""}</Badge>}
                      {!u.admin_role && !u.restricted_until && !u.warnings && <Badge>Active</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-soft">
            <span>
              {total} {total === 1 ? "account" : "accounts"} · engagement = opened · saved · lessons · posts
            </span>
            <span className="flex items-center gap-2">
              <button className={btn.small} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              Page {page + 1} of {pages}
              <button className={btn.small} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Audience: totals only, groups under 5 hidden */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Topics men follow" sub={`Counts only. Topics followed by fewer than ${adoption.data?.min_group ?? 5} men are hidden to protect privacy.`}>
          {adoption.error ? (
            <p className="text-sm text-ink-soft">{adoption.error}</p>
          ) : !adoption.data ? (
            <p className="text-sm text-ink-soft">Loading…</p>
          ) : (
            (() => {
              const rows = TOPICS.map((t) => ({ label: t.title, n: adoption.data!.topics_followed[t.id] })).filter((r): r is { label: string; n: number } => typeof r.n === "number");
              const hidden = TOPICS.filter((t) => adoption.data!.topics_followed[t.id] === null).length;
              return rows.length ? (
                <>
                  <RankBars rows={rows.sort((a, b) => b.n - a.n)} unit="men" />
                  {hidden > 0 && <p className="mt-3 text-[11px] text-ink-soft">{hidden} more topic{hidden > 1 ? "s" : ""} with fewer than 5 followers.</p>}
                </>
              ) : (
                <p className="text-sm text-ink-soft">No topic has 5 or more followers yet.</p>
              )
            })()
          )}
        </Panel>
        <Panel title="Features used" sub="How many synced accounts have used each feature at least once (counts only).">
          {adoption.data ? (
            <RankBars
              unit="men"
              rows={[
                { label: "Water tracking", n: adoption.data.water },
                { label: "Sleep tracking", n: adoption.data.sleep },
                { label: "Energy & mood check-in", n: adoption.data.checkin },
                { label: "Daily activities", n: adoption.data.activities },
                { label: "Lessons", n: adoption.data.lessons },
                { label: "Saved content", n: adoption.data.saved },
              ]}
            />
          ) : (
            <p className="text-sm text-ink-soft">{adoption.error ?? "Loading…"}</p>
          )}
          {adoption.data && <p className="mt-3 text-[11px] text-ink-soft">Out of {adoption.data.synced_users} accounts that have saved data. Guests (phone only) aren&apos;t counted.</p>}
        </Panel>
      </div>

      {open && <UserDrawer user={open} onClose={() => setOpen(null)} onChanged={list.reload} canRestrict={studio.can("users.restrict")} canWarn={studio.can("users.restrict") || studio.can("community.moderate")} canDelete={studio.can("users.delete")} me={studio.admin.userId} />}
    </div>
  );
}

function UserDrawer({ user: u, onClose, onChanged, canRestrict, canWarn, canDelete, me }: { user: U; onClose: () => void; onChanged: () => void; canRestrict: boolean; canWarn: boolean; canDelete: boolean; me: string }) {
  const showToast = useToast();
  const notes = useLoad(async () => {
    if (!canRestrict) return [] as Note[]; // support notes: owners and moderators only (the database enforces it)
    const { data, error } = await db().from("user_notes").select("id,body,created_at,author").eq("user_id", u.id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Note[];
  }, [u.id, canRestrict]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restrict, setRestrict] = useState<{ days: number } | null>(null);
  const [reason, setReason] = useState("");
  const [warn, setWarn] = useState(false);
  const [message, setMessage] = useState("");
  const [del, setDel] = useState(false);
  const isAdmin = Boolean(u.admin_role);
  const isMe = u.id === me;

  async function run(fn: () => Promise<unknown>, done: string, close = false) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      showToast(done);
      onChanged();
      notes.reload();
      if (close) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open title={u.email ?? "Account"} onClose={onClose}>
      <div className="space-y-5 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-ink-soft">Joined</dt>
            <dd>{fmtDate(u.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Last active</dt>
            <dd>{u.last_active ? fmtDate(u.last_active) : "Not tracked yet"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Last sign-in</dt>
            <dd>{ago(u.last_sign_in_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Set up (topics or name)</dt>
            <dd>{u.onboarded ? "Yes" : "Not yet"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-ink-soft">Engagement</dt>
            <dd>
              {u.opened} opened · {u.saved} saved · {u.lessons} lessons · {u.posts} community posts
            </dd>
          </div>
        </dl>
        <p className="flex items-start gap-2 rounded-xl bg-bg px-3 py-2 text-xs text-ink-soft">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-forest" /> His check-ins, sleep, water, notes and profile details are private and not available to admins.
        </p>

        {error && <ErrorBox error={error} />}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {canWarn && !isMe && (
            <button className={btn.ghost} onClick={() => setWarn(true)} disabled={busy}>
              <MessageSquareWarning size={14} /> Warn
            </button>
          )}
          {canRestrict && !isAdmin && !isMe && (
            u.restricted_until ? (
              <button className={btn.ghost} disabled={busy} onClick={() => setRestrict({ days: 0 })}>
                <UserCheck size={14} /> Lift restriction
              </button>
            ) : (
              <button className={btn.ghost} disabled={busy} onClick={() => setRestrict({ days: 7 })}>
                <Ban size={14} /> Restrict
              </button>
            )
          )}
          {canDelete && u.admin_role !== "owner" && !isMe && (
            <button className={`${btn.ghost} text-red-700`} disabled={busy} onClick={() => setDel(true)}>
              <Trash2 size={14} /> Delete account
            </button>
          )}
        </div>
        {isAdmin && <p className="text-xs text-ink-soft">Admins can&apos;t be restricted here. Change their role in Settings → Admins first.</p>}

        {/* Support notes: owners and moderators */}
        {canRestrict && (
        <section>
          <h3 className="text-sm font-bold">Support notes</h3>
          <p className="text-xs text-ink-soft">Only admins see these. Don&apos;t write health details.</p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              run(async () => {
                const { error } = await db().from("user_notes").insert({ user_id: u.id, body: note.trim(), author: me });
                if (error) throw new Error(error.message);
                setNote("");
              }, "Note added");
            }}
          >
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Asked for help resetting password" className={input} aria-label="New note" />
            <button className={btn.primary} disabled={busy || !note.trim()}>
              Add
            </button>
          </form>
          <ul className="mt-3 space-y-2">
            {notes.data?.length === 0 && <li className="text-xs text-ink-soft">No notes yet.</li>}
            {notes.data?.map((n) => (
              <li key={n.id} className="rounded-xl bg-bg px-3 py-2">
                <p className="whitespace-pre-line text-sm">{n.body}</p>
                <p className="mt-1 text-[11px] text-ink-soft">{fmtDate(n.created_at, true)}</p>
              </li>
            ))}
            {notes.error && <li className="text-xs text-red-700">{notes.error}</li>}
          </ul>
        </section>
        )}
      </div>

      <Confirm
        open={restrict !== null}
        title={restrict?.days ? "Restrict this account?" : "Lift the restriction?"}
        confirmLabel={restrict?.days ? "Restrict" : "Lift restriction"}
        danger={Boolean(restrict?.days)}
        busy={busy}
        disabled={!reason.trim()}
        onClose={() => setRestrict(null)}
        onConfirm={() => {
          void run(() => rpc("admin_restrict_user", { p_user: u.id, p_days: restrict!.days, p_reason: reason.trim() }), restrict!.days ? `Restricted for ${restrict!.days} days` : "Restriction lifted").then(() => {
            setRestrict(null);
            setReason("");
          });
        }}
      >
        {restrict?.days ? (
          <>
            <p>He can&apos;t sign in or post until it ends. If he is signed in now, he&apos;s blocked within the hour (when his session renews).</p>
            <label className="mt-3 block text-xs">
              How long
              <select value={restrict.days} onChange={(e) => setRestrict({ days: Number(e.target.value) })} className={`${input} mt-1`}>
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={365}>1 year</option>
              </select>
            </label>
          </>
        ) : (
          <p>He can sign in and post again straight away.</p>
        )}
        <label className="mt-3 block text-xs">
          Reason (required · kept in the support notes and audit log)
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${input} mt-1`} />
        </label>
      </Confirm>

      <Confirm
        open={warn}
        title="Send a warning"
        confirmLabel="Send warning"
        busy={busy}
        disabled={message.trim().length < 5}
        onClose={() => setWarn(false)}
        onConfirm={() => {
          void run(() => rpc("admin_warn_user", { p_user: u.id, p_message: message.trim() }), "Warning sent to his inbox").then(() => {
            setWarn(false);
            setMessage("");
          });
        }}
      >
        <p>He sees it in his app inbox (the bell) next time he opens the app. It&apos;s logged.</p>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} className={`${input} mt-3 min-h-24`} placeholder="Please keep Community free of selling. Next time your account will be restricted." />
      </Confirm>

      <Confirm
        open={del}
        title="Delete this account for good?"
        confirmLabel="Delete account"
        danger
        typeToConfirm="delete"
        busy={busy}
        onClose={() => setDel(false)}
        onConfirm={() => void run(() => rpc("admin_delete_user", { p_user: u.id }), "Account deleted", true).then(() => setDel(false))}
      >
        His login and everything saved in it (progress, posts, replies, reactions) are deleted. This can&apos;t be undone. Use this for deletion requests;
        use Restrict for behaviour problems.
      </Confirm>
    </Drawer>
  );
}
