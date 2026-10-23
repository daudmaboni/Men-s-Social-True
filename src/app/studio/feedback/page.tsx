"use client";

// Studio → Feedback (Step 85): what men send from Me → Tell us. Newest first. Mark each one read or done.
// Staff who can see users (owner, editor, moderator, analyst) can read it; every change is in the audit log.

import { useState } from "react";
import Link from "next/link";
import { Quote, Star } from "lucide-react";
import { Badge, Empty, ErrorBox, Loading, PageHeader, Panel, Segmented, btn, fmtDate, useLoad } from "@/components/admin/ui";
import { rpc } from "@/lib/admin/api";

type Row = { id: string; created_at: string; message: string; rating: number | null; place: string | null; lang: string | null; platform: string | null; status: "new" | "read" | "done"; who: string; share_ok?: boolean };
const PLATFORM: Record<string, string> = { android: "Android app", ios: "iPhone app", pwa: "Home-screen app", web: "Browser" };

export default function FeedbackPage() {
  const [show, setShow] = useState<"open" | "done" | "all" | "stories">("open");
  const list = useLoad(() => rpc<Row[]>("feedback_list", { p_status: show, p_limit: 300 }), [show]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function mark(id: string, status: Row["status"]) {
    setBusy(id);
    setErr(null);
    try {
      await rpc("feedback_mark", { p_id: id, p_status: status });
      list.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const rows = list.data ?? [];
  const rated = rows.filter((r) => r.rating);
  const avg = rated.length ? (rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length).toFixed(1) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Feedback" sub="What men send from Me → Tell us. Newest first." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={show}
          onChange={(v) => setShow(v)}
          options={[
            { id: "open", label: "To read" },
            { id: "done", label: "Done" },
            { id: "all", label: "All" },
            { id: "stories", label: "May share" },
          ]}
        />
        {avg && (
          <p className="flex items-center gap-1 text-sm text-ink-soft">
            <Star size={15} className="text-honey" fill="currentColor" /> {avg} average from {rated.length} rating{rated.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      {err && <ErrorBox error={err} />}
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox error={/feedback_list|does not exist|Could not find/i.test(list.error) ? "Run migration 0018 in Supabase first (SQL Editor)." : list.error} />
      ) : rows.length === 0 ? (
        <Empty title={show === "open" ? "Nothing new to read" : "No feedback yet"}>When men send something from Me → Tell us, it shows here.</Empty>
      ) : (
        <Panel title={`${rows.length} message${rows.length === 1 ? "" : "s"}`}>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  {r.status === "new" && <Badge tone="warn">New</Badge>}
                  {r.status === "done" && <Badge tone="good">Done</Badge>}
                  {r.rating && (
                    <span className="flex items-center gap-0.5 font-semibold text-ink">
                      {r.rating}
                      <Star size={12} className="text-honey" fill="currentColor" />
                    </span>
                  )}
                  <span>{fmtDate(r.created_at, true)}</span>
                  <span>· {r.who}</span>
                  {r.platform && <span>· {PLATFORM[r.platform] ?? r.platform}</span>}
                  {r.lang && <span>· {r.lang === "sw" ? "Kiswahili" : "English"}</span>}
                  {r.share_ok && <Badge tone="info">May share as a story</Badge>}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{r.message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.share_ok && (
                    <Link href={`/studio/stories?from=${r.id}`} className={btn.ghost}>
                      <Quote size={14} /> Make a story
                    </Link>
                  )}
                  {r.status === "new" && (
                    <button disabled={busy === r.id} onClick={() => mark(r.id, "read")} className={btn.ghost}>
                      Mark read
                    </button>
                  )}
                  {r.status !== "done" ? (
                    <button disabled={busy === r.id} onClick={() => mark(r.id, "done")} className={btn.primary}>
                      Done
                    </button>
                  ) : (
                    <button disabled={busy === r.id} onClick={() => mark(r.id, "read")} className={btn.ghost}>
                      Open again
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
