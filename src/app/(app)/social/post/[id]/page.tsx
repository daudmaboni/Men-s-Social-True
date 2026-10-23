"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Flag, Lock, Stethoscope, Trash2 } from "lucide-react";
import { AuthorLine } from "@/components/social/PostCard";
import ReactionBar from "@/components/social/ReactionBar";
import ReportSheet from "@/components/social/ReportSheet";
import { useCommunity } from "@/components/social/useCommunity";
import { useToast } from "@/components/motion/Toast";
import { checkReply, LIMITS, topicLabel } from "@/lib/social/community";
import LockedTab from "@/components/account/LockedTab";
import { useAccount } from "@/lib/account/useAccount";
import { useT } from "@/lib/i18n";
import SyncPull from "@/components/motion/SyncPull";
import { loadReplies, refreshCommunity } from "@/lib/social/communityServer";

/** Community posts need an account, like the Community tab itself. */
export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const acc = useAccount();
  const t = useT();
  if (acc.status === "loading") return <div className="h-64 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />;
  if (acc.status === "guest") {
    return (
      <div className="space-y-4">
        <Link href="/social" className="flex items-center gap-1 text-sm text-ink-soft">
          <ArrowLeft size={16} /> {t("Social")}
        </Link>
        <LockedTab tab="community" />
      </div>
    );
  }
  // Pull down at the top: new replies and reactions, plus sync now (Step 78)
  return (
    <SyncPull also={() => Promise.all([refreshCommunity(), id ? loadReplies(id) : null])}>
      <PostView />
    </SyncPull>
  );
}

function PostView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const showToast = useToast();
  const c = useCommunity();
  const t = useT();
  const [reply, setReply] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Shared Community: replies load from the server
  const { loadReplies, mode } = c;
  useEffect(() => {
    if (mode === "server") void loadReplies(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode]);

  const back = (
    <Link href="/social?tab=community" className="flex items-center gap-1 text-sm text-ink-soft">
      <ArrowLeft size={16} /> {t("Community")}
    </Link>
  );

  if (!c.ready) {
    return (
      <div className="space-y-4" aria-busy="true">
        {back}
        <div className="h-48 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />
      </div>
    );
  }

  const post = c.getPost(id);
  if (!post) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
          <p className="font-semibold">{t(c.isReported(id) ? "You reported this post" : "This conversation isn't available")}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {t(c.isReported(id) ? "It's hidden for you and sent to our moderators." : "It may have been removed.")}
          </p>
          {c.isReported(id) && (
            <button
              onClick={() => void c.undoReport(id)}
              className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line"
            >
              {t("Undo report")}
            </button>
          )}
        </div>
      </div>
    );
  }

  const replies = c.repliesFor(post.id);

  async function send() {
    const problem = checkReply(reply);
    if (problem) return setError(t(problem));
    setSending(true);
    try {
      await c.reply(post!.id, reply, anonymous || !c.nickname);
    } catch (e) {
      setSending(false);
      return setError(t((e as Error).message));
    }
    setSending(false);
    setReply("");
    showToast(t("Reply posted"));
  }

  return (
    <div className="space-y-4">
      {back}

      <article className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <div className="flex items-start justify-between gap-2">
          <AuthorLine author={post.author} at={post.createdAt} fixture={post.fixture} mine={post.mine} />
          {post.mine ? (
            <button
              aria-label={t("Delete post")}
              onClick={() => {
                void c.deletePost(post.id);
                showToast(t("Post deleted"));
                router.push("/social?tab=community");
              }}
              className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft"
            >
              <Trash2 size={15} />
            </button>
          ) : (
            <button
              aria-label={t("Report post")}
              onClick={() => setReporting(post.id)}
              className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft"
            >
              <Flag size={14} />
            </button>
          )}
        </div>
        <p className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-forest">{t(topicLabel(post.topic))}</p>
        <h1 className="mt-0.5 text-xl font-bold leading-snug">{post.title}</h1>
        {post.body && <p className="mt-2 whitespace-pre-line text-[0.9375rem] leading-relaxed">{post.body}</p>}
        {post.status && post.status !== "visible" && <HiddenNote />}
        {post.wantsExpert && (
          <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-bg px-3 py-2 text-xs text-ink-soft ring-1 ring-line">
            <Stethoscope size={14} className="mt-px shrink-0" />
            {t("Waiting for a verified expert. Verified professionals aren't on the app yet — this question is queued for them.")}
          </p>
        )}
        <div className="mt-4">
          <ReactionBar targetId={post.id} base={post.baseReactions} />
        </div>
      </article>

      <h2 className="px-1 text-sm font-bold">
        {replies.length ? t(replies.length === 1 ? "{n} reply" : "{n} replies", { n: replies.length }) : t("No replies yet")}
      </h2>

      <div className="stagger space-y-3">
        {replies.map((r) => (
          <div key={r.id} className="rounded-3xl bg-surface p-4 ring-1 ring-line">
            <div className="flex items-start justify-between gap-2">
              <AuthorLine author={r.author} at={r.createdAt} fixture={r.fixture} mine={r.mine} />
              {r.mine ? (
                <button
                  aria-label={t("Delete reply")}
                  onClick={() => {
                    void c.deleteReply(r.id, post.id);
                    showToast(t("Reply deleted"));
                  }}
                  className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft"
                >
                  <Trash2 size={14} />
                </button>
              ) : (
                <button
                  aria-label={t("Report reply")}
                  onClick={() => setReporting(r.id)}
                  className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft"
                >
                  <Flag size={13} />
                </button>
              )}
            </div>
            {r.status && r.status !== "visible" && <HiddenNote />}
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{r.body}</p>
            <div className="mt-3">
              <ReactionBar targetId={r.id} base={r.baseReactions} compact />
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
        <label htmlFor="reply" className="text-xs font-semibold">
          {t("Add a supportive reply")}
        </label>
        <textarea
          id="reply"
          rows={3}
          value={reply}
          maxLength={LIMITS.replyMax}
          onChange={(e) => {
            setReply(e.target.value);
            setError("");
          }}
          placeholder={t("Share what helped you. Be kind.")}
          className="mt-2 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
        />
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">
            {error}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={anonymous || !c.nickname}
              disabled={!c.nickname}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-4 w-4 accent-[var(--forest)]"
            />
            {t(c.nickname ? "Reply anonymously" : "Replying anonymously")}
          </label>
          <button onClick={send} disabled={sending} className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {t("Reply")}
          </button>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[0.6875rem] text-ink-soft">
          <Lock size={11} className="mt-px shrink-0" /> {t("Don't share phone numbers, links or private details.")}
        </p>
      </div>

      <ReportSheet
        targetId={reporting ?? ""}
        type={reporting === post.id ? "post" : "reply"}
        open={reporting !== null}
        onClose={() => setReporting(null)}
        onReported={() => {
          if (reporting === post.id) router.push("/social?tab=community");
        }}
      />
    </div>
  );
}

/** His own post or reply that moderators hid: only he still sees it. */
function HiddenNote() {
  const t = useT();
  return (
    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {t("Hidden by our moderators. Only you can see this.")}
    </p>
  );
}
