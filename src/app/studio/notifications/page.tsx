"use client";

// Admin → Notifications: write, preview, target, schedule and send in-app messages.
// Delivery is real and measured: "delivered" = it appeared in his inbox; "opened" = he tapped it.
// Phone push needs a push service (not connected yet) — shown honestly below.

import { useMemo, useState } from "react";
import { Bell, Send, Smartphone, X } from "lucide-react";
import { useStudio } from "@/components/admin/AdminShell";
import { Badge, Confirm, Empty, ErrorBox, Loading, NotConnected, PageHeader, Panel, btn, fmtDate, input, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import { rpc, select } from "@/lib/admin/api";
import { TOPICS } from "@/lib/content/library";

type Campaign = { id: string; title: string; body: string; kind: Kind; link: string | null; segment: string; status: "draft" | "scheduled" | "cancelled"; send_at: string | null; created_at: string };
type Stat = { id: string; delivered: number; opened: number; audience: number };
type Kind = "announcement" | "new_content" | "tip" | "community" | "reengagement" | "warning";

const KINDS: { id: Exclude<Kind, "warning">; label: string; pref: string }[] = [
  { id: "announcement", label: "Announcement", pref: "News from the Men's Social team" },
  { id: "new_content", label: "New content", pref: "New guides and videos" },
  { id: "tip", label: "Wellness tip", pref: "Wellness tips" },
  { id: "community", label: "Community", pref: "Community news" },
  { id: "reengagement", label: "We miss you (re-engagement)", pref: "News from the Men's Social team" },
];
const SEGMENTS = [
  { id: "all", label: "Everyone with an account" },
  { id: "new_7d", label: "New men (joined in the last 7 days)" },
  { id: "active_7d", label: "Active in the last 7 days" },
  { id: "inactive_7d", label: "Not active in the last 7 days" },
  ...TOPICS.map((t) => ({ id: `topic:${t.id}`, label: `Men who follow ${t.short}` })),
];
const LINKS = [
  { id: "", label: "No link" },
  { id: "/social", label: "Discover" },
  { id: "/social?tab=community", label: "Community" },
  { id: "/man", label: "Man (daily activities)" },
  { id: "/me", label: "Me" },
  { id: "/learn", label: "Lessons" },
];
const segLabel = (s: string) => (s.startsWith("user:") ? "One man (warning)" : SEGMENTS.find((x) => x.id === s)?.label ?? s);
const blank = { id: null as string | null, title: "", body: "", kind: "announcement" as Exclude<Kind, "warning">, link: "", segment: "all" };

export default function NotificationsPage() {
  const studio = useStudio();
  const showToast = useToast();
  const list = useLoad(() => select<Campaign>("notification_campaigns", "id,title,body,kind,link,segment,status,send_at,created_at", (q) => q.order("created_at", { ascending: false }).limit(100)), []);
  const stats = useLoad(() => rpc<Stat[]>("notif_stats"), []);
  const [form, setForm] = useState(blank);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [cancel, setCancel] = useState<Campaign | null>(null);
  const statById = useMemo(() => new Map((stats.data ?? []).map((s) => [s.id, s])), [stats.data]);
  const valid = form.title.trim().length >= 3 && form.body.trim().length >= 3 && (when === "now" || Boolean(at));

  const reload = () => {
    list.reload();
    stats.reload();
  };
  async function save(): Promise<string> {
    return rpc<string>("notif_save", { p_id: form.id, p_title: form.title.trim(), p_body: form.body.trim(), p_kind: form.kind, p_link: form.link || null, p_segment: form.segment });
  }
  async function doSave() {
    setBusy(true);
    setError(null);
    try {
      const id = await save();
      setForm((f) => ({ ...f, id }));
      showToast("Draft saved");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function doSend() {
    setConfirm(false);
    setBusy(true);
    setError(null);
    try {
      const id = await save();
      setForm((f) => ({ ...f, id })); // if sending is refused, the saved draft is kept and edited, not duplicated
      await rpc("notif_schedule", { p_id: id, p_at: when === "now" ? null : new Date(at).toISOString() });
      showToast(when === "now" ? "Sent · men see it next time they open the app" : "Scheduled");
      setForm(blank);
      setAt("");
      reload();
    } catch (e) {
      setError((e as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const statusOf = (c: Campaign) =>
    c.status === "draft" ? <Badge>Draft</Badge> : c.status === "cancelled" ? <Badge>Cancelled</Badge> : c.send_at && new Date(c.send_at) > new Date() ? <Badge tone="info">Scheduled</Badge> : <Badge tone="good">Sent</Badge>;

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" sub="Messages to men's in-app inbox (the bell). Each man can switch types off on his Me page." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={form.id ? "Edit draft" : "New message"} actions={form.id ? <button className={btn.small} onClick={() => setForm(blank)}>New instead</button> : undefined}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-ink-soft">
              Type
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })} className={`${input} mt-1 font-normal text-ink`}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block font-normal">Men who switched off &ldquo;{KINDS.find((k) => k.id === form.kind)?.pref}&rdquo; on Me won&apos;t get it.</span>
            </label>
            <label className="block text-xs font-semibold text-ink-soft">
              Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} className={`${input} mt-1 font-normal text-ink`} placeholder="A new guide on sleep and energy" />
            </label>
            <label className="block text-xs font-semibold text-ink-soft">
              Message
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={300} className={`${input} mt-1 min-h-24 font-normal text-ink`} placeholder="Short and friendly. No private health words — it may be seen on his screen." />
              <span className="mt-1 block text-right font-normal">{form.body.length}/300</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-ink-soft">
                Opens
                <select value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className={`${input} mt-1 font-normal text-ink`}>
                  {LINKS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-ink-soft">
                Who gets it
                <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className={`${input} mt-1 font-normal text-ink`}>
                  {SEGMENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="text-xs font-semibold text-ink-soft">
              <legend>When</legend>
              <div className="mt-1 flex flex-wrap items-center gap-3 font-normal text-ink">
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="accent-forest" /> Now
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="accent-forest" /> Later
                </label>
                {when === "later" && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={`${input} max-w-xs`} aria-label="Send at" />}
              </div>
            </fieldset>
            {error && <ErrorBox error={error} />}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button className={btn.ghost} disabled={busy || form.title.trim().length < 3 || form.body.trim().length < 3} onClick={doSave}>
                Save draft
              </button>
              <button className={btn.primary} disabled={busy || !valid} onClick={() => setConfirm(true)}>
                <Send size={14} /> {when === "now" ? "Send" : "Schedule"}
              </button>
            </div>
            <p className="text-[0.6875rem] text-ink-soft">Protections: the same message can&apos;t go out twice within 24 hours, and at most 3 messages go out in any 24 hours.</p>
          </div>
        </Panel>

        {/* Preview */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Preview in his inbox</p>
          <div className="rounded-3xl bg-bg p-4 ring-1 ring-line">
            <div className="flex items-start gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-line">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white">
                <Bell size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{form.title || "Your title"}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{form.body || "Your message"}</p>
                <p className="mt-1 text-[0.625rem] text-ink-soft">just now{form.link ? ` · opens ${LINKS.find((l) => l.id === form.link)?.label}` : ""}</p>
              </div>
            </div>
          </div>
          <NotConnected title="Phone push notifications: not connected">
            Messages arrive in the in-app inbox when he opens the app. Pop-up alerts on his lock screen need a push service: VAPID keys, a service
            worker and a small server sender (e.g. a Supabase Edge Function). Ask your developer to connect it; nothing here pretends it&apos;s sent as a push.
          </NotConnected>
          <p className="flex items-start gap-2 text-[0.6875rem] text-ink-soft">
            <Smartphone size={13} className="mt-0.5 shrink-0" /> Men turn types off on Me → Notifications. Warnings to a single man always arrive.
          </p>
        </div>
      </div>

      <Panel title="Messages" sub="Delivered = shown in his inbox · Opened = he tapped it · Audience = men who match the target now">
        {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
        {!list.data && list.loading && <Loading />}
        {list.data &&
          (list.data.length === 0 ? (
            <Empty title="No messages yet">Write your first one above.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="text-left text-xs text-ink-soft">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-semibold">Message</th>
                    <th className="py-2 pr-3 font-semibold">To</th>
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 text-right font-semibold">Delivered</th>
                    <th className="py-2 pr-3 text-right font-semibold">Opened</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.data.map((c) => {
                    const s = statById.get(c.id);
                    return (
                      <tr key={c.id}>
                        <td className="max-w-xs py-2 pr-3">
                          <p className="truncate font-medium">{c.title}</p>
                          <p className="truncate text-xs text-ink-soft">{c.body}</p>
                        </td>
                        <td className="py-2 pr-3 text-xs text-ink-soft">{segLabel(c.segment)}</td>
                        <td className="py-2 pr-3 text-xs text-ink-soft">{c.send_at ? fmtDate(c.send_at, true) : "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{s ? `${s.delivered}${s.audience ? ` / ${s.audience}` : ""}` : "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{s ? s.opened : "—"}</td>
                        <td className="py-2 pr-3">{statusOf(c)}</td>
                        <td className="py-2 text-right">
                          {c.status === "draft" && c.kind !== "warning" && (
                            <button className={btn.small} onClick={() => setForm({ id: c.id, title: c.title, body: c.body, kind: c.kind as typeof form.kind, link: c.link ?? "", segment: c.segment })}>
                              Edit
                            </button>
                          )}
                          {(c.status === "draft" || (c.status === "scheduled" && c.send_at && new Date(c.send_at) > new Date())) && studio.can("notifications.send") && (
                            <button className={`${btn.small} ml-1`} onClick={() => setCancel(c)} aria-label={`Cancel ${c.title}`}>
                              <X size={12} /> Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </Panel>

      <Confirm open={confirm} title={when === "now" ? "Send this message now?" : "Schedule this message?"} confirmLabel={when === "now" ? "Send" : "Schedule"} busy={busy} onConfirm={doSend} onClose={() => setConfirm(false)}>
        To: {segLabel(form.segment)}. {when === "now" ? "Men see it the next time they open the app." : `Goes out ${at ? new Date(at).toLocaleString("en-GB") : ""}.`} It can&apos;t be edited after sending.
      </Confirm>
      <Confirm
        open={cancel !== null}
        title="Cancel this message?"
        confirmLabel="Cancel message"
        danger
        busy={busy}
        onClose={() => setCancel(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await rpc("notif_cancel", { p_id: cancel!.id });
            showToast("Cancelled");
            reload();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
            setCancel(null);
          }
        }}
      >
        It won&apos;t be sent. Already-delivered messages can&apos;t be taken back.
      </Confirm>
    </div>
  );
}
