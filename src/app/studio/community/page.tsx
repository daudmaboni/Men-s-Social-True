"use client";

// Admin → Community: the moderation workspace. Urgent reports first; act on posts and replies;
// warn or restrict authors; pin and feature good discussions. Every action is logged.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Ban, Bot, Eye, EyeOff, MessageSquareWarning, Pin, ShieldCheck, Star, Trash2 } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, Confirm, Empty, ErrorBox, Loading, PageHeader, Panel, Segmented, ago, btn, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { rpc, select } from "@/lib/admin/api";
import { actionLabel } from "@/lib/admin/audit";
import { topicLabel, type CommunityTopic } from "@/lib/social/community";

type Report = { id: string; target_type: "post" | "reply"; target_id: string; reason: string; urgent: boolean; auto: boolean; status: string; resolution: string | null; created_at: string; resolved_at: string | null; excerpt: string; target_status: string };
type Item = { type: "post" | "reply"; id: string; post_id: string; title: string | null; body: string; topic: string | null; status: string; pinned: boolean; featured: boolean; anonymous: boolean; display_name: string | null; author_label: string | null; author_id: string; created_at: string; open_reports: number; urgent: boolean; reply_count: number };
type AuditRow = { id: number; action: string; target: string | null; at: string; details: Record<string, unknown> };

export default function CommunityAdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const studio = useStudio();
  const params = useSearchParams();
  const [tab, setTab] = useState<"reports" | "content" | "activity">(params.get("tab") === "content" ? "content" : "reports");
  const [rStatus, setRStatus] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [filter, setFilter] = useState<"all" | "reported" | "urgent" | "hidden" | "pinned" | "posts" | "replies">("all");
  const reports = useLoad(() => rpc<Report[]>("mod_reports", { p_status: rStatus }), [rStatus]);
  const items = useLoad(() => rpc<Item[]>("mod_items", { p_filter: filter, p_limit: 200 }), [filter]);
  const activity = useLoad(
    () => (studio.can("audit.view") ? select<AuditRow>("admin_audit", "id,action,target,at,details", (q) => q.or("action.like.community.*,action.like.report.*,action.eq.user.warn,action.like.user.*restrict").order("at", { ascending: false }).limit(50)) : Promise.resolve([])),
    [studio],
  );
  const reload = () => {
    reports.reload();
    items.reload();
    activity.reload();
  };
  const urgent = (reports.data ?? []).filter((r) => r.urgent && r.status === "open").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Community"
        sub="Keep Community safe: scams, harassment, private information and risky health advice. Men never see who reported them."
        actions={
          <Segmented
            label="Section"
            value={tab}
            onChange={setTab}
            options={[
              { id: "reports", label: `Reports${rStatus === "open" && reports.data ? ` (${reports.data.length})` : ""}` },
              { id: "content", label: "Posts & replies" },
              { id: "activity", label: "Moderator activity" },
            ]}
          />
        }
      />

      {urgent > 0 && tab !== "reports" && (
        <button onClick={() => setTab("reports")} className="flex w-full items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-800">
          <AlertTriangle size={16} /> {urgent} urgent {urgent === 1 ? "report" : "reports"} waiting
        </button>
      )}

      {tab === "reports" && (
        <>
          <Segmented label="Report status" value={rStatus} onChange={setRStatus} options={[{ id: "open", label: "Open" }, { id: "resolved", label: "Resolved" }, { id: "dismissed", label: "Dismissed" }, { id: "all", label: "All" }]} />
          {reports.error && <ErrorBox error={reports.error} onRetry={reports.reload} />}
          {!reports.data && reports.loading && <Loading />}
          {reports.data && (reports.data.length === 0 ? (
            <div className="rounded-2xl bg-surface ring-1 ring-line">
              <Empty title={rStatus === "open" ? "No open reports" : "Nothing here"}>{rStatus === "open" ? "When men report something, or the automatic check flags risky advice, it appears here." : undefined}</Empty>
            </div>
          ) : (
            <ul className={`space-y-3 ${reports.loading ? "opacity-60" : ""}`}>
              {reports.data.map((r) => (
                <ReportCard key={r.id} r={r} onDone={reload} />
              ))}
            </ul>
          ))}
        </>
      )}

      {tab === "content" && (
        <>
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All" },
              { id: "reported", label: "Reported" },
              { id: "urgent", label: "Urgent" },
              { id: "hidden", label: "Hidden/removed" },
              { id: "pinned", label: "Pinned/featured" },
              { id: "posts", label: "Posts" },
              { id: "replies", label: "Replies" },
            ]}
          />
          {items.error && <ErrorBox error={items.error} onRetry={items.reload} />}
          {!items.data && items.loading && <Loading />}
          {items.data && (items.data.length === 0 ? (
            <div className="rounded-2xl bg-surface ring-1 ring-line">
              <Empty title="Nothing here yet">Questions and replies men post in Community appear here.</Empty>
            </div>
          ) : (
            <ul className={`space-y-3 ${items.loading ? "opacity-60" : ""}`}>
              {items.data.map((it) => (
                <ItemCard key={it.id} it={it} onDone={reload} canRestrict={studio.can("users.restrict")} />
              ))}
            </ul>
          ))}
        </>
      )}

      {tab === "activity" && (
        <Panel title="Moderator activity" sub="Every moderation action, newest first.">
          {!studio.can("audit.view") ? (
            <p className="text-sm text-ink-soft">Your role can&apos;t see the activity log.</p>
          ) : activity.error ? (
            <ErrorBox error={activity.error} />
          ) : !activity.data ? (
            <Loading />
          ) : activity.data.length === 0 ? (
            <p className="text-sm text-ink-soft">No moderation actions yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {activity.data.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <b className="font-semibold">{actionLabel(a.action)}</b>
                    {typeof a.details?.reason === "string" && a.details.reason ? ` · ${a.details.reason}` : ""}
                    {typeof a.details?.resolution === "string" && a.details.resolution ? ` · ${a.details.resolution}` : ""}
                  </span>
                  <span className="text-xs text-ink-soft">{ago(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="Automatic safeguards" sub="These run in the database for every post and reply.">
        <ul className="space-y-1.5 text-sm text-ink-soft">
          <li className="flex gap-2">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" /> Blocked before posting: phone numbers, links, private-contact requests, selling and prices.
          </li>
          <li className="flex gap-2">
            <Bot size={15} className="mt-0.5 shrink-0 text-forest" /> Flagged as urgent (stays visible until you decide): risky health advice like &ldquo;stop taking&rdquo;, &ldquo;double the dose&rdquo;, &ldquo;guaranteed cure&rdquo;, &ldquo;bila daktari&rdquo;.
          </li>
          <li className="flex gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-forest" /> Reports for misinformation, harassment and private information are marked urgent. A man who reports something stops seeing it.
          </li>
          <li className="flex gap-2">
            <Ban size={15} className="mt-0.5 shrink-0 text-forest" /> Restricted accounts can&apos;t post or reply. At most 5 questions per hour per man.
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function useAct(onDone: () => void) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      showToast(msg);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function ReportCard({ r, onDone }: { r: Report; onDone: () => void }) {
  const { busy, error, run } = useAct(onDone);
  const [note, setNote] = useState("");
  const setStatus = (status: string, msg: string) => run(() => rpc("mod_set_status", { p_type: r.target_type, p_id: r.target_id, p_status: status, p_reason: note.trim() || `${r.reason}` }), msg);
  return (
    <li className={`rounded-2xl bg-surface p-4 ring-1 ${r.urgent && r.status === "open" ? "ring-red-300" : "ring-line"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {r.urgent && <Badge tone="bad">Urgent</Badge>}
        {r.auto && <Badge tone="info">Automatic check</Badge>}
        <Badge>{r.target_type === "post" ? "Question" : "Reply"}</Badge>
        <Badge tone={r.target_status === "visible" ? "neutral" : "warn"}>Currently {r.target_status}</Badge>
        {r.status !== "open" && <Badge tone="good">{r.status}</Badge>}
        <span className="ml-auto text-ink-soft">{ago(r.created_at)}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{r.reason}</p>
      <p className="mt-1 rounded-xl bg-bg px-3 py-2 text-sm">{r.excerpt}</p>
      {r.resolution && <p className="mt-1 text-xs text-ink-soft">Resolution: {r.resolution}</p>}
      {error && (
        <div className="mt-2">
          <ErrorBox error={error} />
        </div>
      )}
      {r.status === "open" ? (
        <div className="mt-3 space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note for the log (optional)" className={input} aria-label="Resolution note" />
          <div className="flex flex-wrap gap-2">
            {r.target_status !== "deleted" && (
              <>
                <button className={btn.small} disabled={busy} onClick={() => setStatus("hidden", "Hidden · report resolved")}>
                  <EyeOff size={13} /> Hide
                </button>
                <button className={`${btn.small} text-red-700`} disabled={busy} onClick={() => setStatus("removed", "Removed · report resolved")}>
                  <Trash2 size={13} /> Remove
                </button>
              </>
            )}
            <button className={btn.small} disabled={busy} onClick={() => run(() => rpc("mod_resolve_report", { p_id: r.id, p_status: "dismissed", p_resolution: note.trim() || "No action needed" }), "Dismissed · item stays up")}>
              Keep it up (dismiss)
            </button>
          </div>
        </div>
      ) : (
        <button className={`${btn.small} mt-3`} disabled={busy} onClick={() => run(() => rpc("mod_resolve_report", { p_id: r.id, p_status: "open", p_resolution: null }), "Reopened")}>
          Reopen
        </button>
      )}
    </li>
  );
}

function ItemCard({ it, onDone, canRestrict }: { it: Item; onDone: () => void; canRestrict: boolean }) {
  const { busy, error, run } = useAct(onDone);
  const [warn, setWarn] = useState(false);
  const [restrict, setRestrict] = useState(false);
  const [msg, setMsg] = useState("");
  const [days, setDays] = useState(7);
  return (
    <li className={`rounded-2xl bg-surface p-4 ring-1 ${it.urgent ? "ring-red-300" : "ring-line"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{it.type === "post" ? "Question" : "Reply"}</Badge>
        {it.topic && <Badge>{topicLabel(it.topic as CommunityTopic)}</Badge>}
        {it.status !== "visible" && <Badge tone="warn">{it.status}</Badge>}
        {it.pinned && <Badge tone="good">Pinned</Badge>}
        {it.featured && <Badge tone="good">Featured</Badge>}
        {it.open_reports > 0 && <Badge tone={it.urgent ? "bad" : "warn"}>{it.open_reports} open report{it.open_reports > 1 ? "s" : ""}</Badge>}
        <span className="ml-auto text-ink-soft">{ago(it.created_at)}</span>
      </div>
      {it.type === "post" ? <p className="mt-2 text-sm font-semibold">{it.title}</p> : <p className="mt-2 text-xs text-ink-soft">Reply to: {it.title}</p>}
      {it.body && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{it.body}</p>}
      <p className="mt-2 text-[0.6875rem] text-ink-soft">
        Shown as: {it.anonymous || !it.display_name ? "Anonymous member" : it.display_name} · Account: {it.author_label ?? "—"}
        {it.type === "post" && ` · ${it.reply_count} replies`}
      </p>
      {error && (
        <div className="mt-2">
          <ErrorBox error={error} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {it.status === "visible" ? (
          <button className={btn.small} disabled={busy} onClick={() => run(() => rpc("mod_set_status", { p_type: it.type, p_id: it.id, p_status: "hidden", p_reason: "Hidden by moderator" }), "Hidden")}>
            <EyeOff size={13} /> Hide
          </button>
        ) : (
          <button className={btn.small} disabled={busy} onClick={() => run(() => rpc("mod_set_status", { p_type: it.type, p_id: it.id, p_status: "visible", p_reason: "Restored by moderator" }), "Restored")}>
            <Eye size={13} /> Restore
          </button>
        )}
        {it.status !== "removed" && (
          <button className={`${btn.small} text-red-700`} disabled={busy} onClick={() => run(() => rpc("mod_set_status", { p_type: it.type, p_id: it.id, p_status: "removed", p_reason: "Removed by moderator" }), "Removed")}>
            <Trash2 size={13} /> Remove
          </button>
        )}
        {it.type === "post" && (
          <>
            <button className={btn.small} disabled={busy} onClick={() => run(() => rpc("mod_flag", { p_id: it.id, p_flag: "pinned", p_on: !it.pinned }), it.pinned ? "Unpinned" : "Pinned to the top")}>
              <Pin size={13} /> {it.pinned ? "Unpin" : "Pin"}
            </button>
            <button className={btn.small} disabled={busy} onClick={() => run(() => rpc("mod_flag", { p_id: it.id, p_flag: "featured", p_on: !it.featured }), it.featured ? "Unfeatured" : "Featured")}>
              <Star size={13} /> {it.featured ? "Unfeature" : "Feature"}
            </button>
          </>
        )}
        <button className={btn.small} disabled={busy} onClick={() => setWarn(true)}>
          <MessageSquareWarning size={13} /> Warn author
        </button>
        {canRestrict && (
          <button className={btn.small} disabled={busy} onClick={() => setRestrict(true)}>
            <Ban size={13} /> Restrict author
          </button>
        )}
      </div>

      <Confirm open={warn} title="Warn the author" confirmLabel="Send warning" busy={busy} disabled={msg.trim().length < 5} onClose={() => setWarn(false)} onConfirm={() => void run(() => rpc("admin_warn_user", { p_user: it.author_id, p_message: msg.trim() }), "Warning sent to his inbox").then(() => (setWarn(false), setMsg("")))}>
        <p>He sees it in his app inbox. He isn&apos;t told who reported him.</p>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} className={`${input} mt-3 min-h-24`} placeholder="Please don't share selling posts in Community." />
      </Confirm>
      <Confirm open={restrict} title="Restrict the author" confirmLabel="Restrict" danger busy={busy} disabled={msg.trim().length < 3} onClose={() => setRestrict(false)} onConfirm={() => void run(() => rpc("admin_restrict_user", { p_user: it.author_id, p_days: days, p_reason: msg.trim() }), `Restricted for ${days} days`).then(() => (setRestrict(false), setMsg("")))}>
        <p>He can&apos;t sign in or post until it ends.</p>
        <label className="mt-3 block text-xs">
          How long
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${input} mt-1`}>
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        <label className="mt-3 block text-xs">
          Reason (required)
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} className={`${input} mt-1`} />
        </label>
      </Confirm>
    </li>
  );
}
