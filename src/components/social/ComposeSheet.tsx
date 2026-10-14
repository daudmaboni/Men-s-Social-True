"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { checkPost, COMMUNITY_TOPICS, LIMITS, type CommunityTopic } from "@/lib/social/community";
import { useSocial } from "@/lib/social/store";
import { useCommunity } from "./useCommunity";
import { useT } from "@/lib/i18n";

/** Ask a question. Anonymous by default. */
export default function ComposeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const showToast = useToast();
  const t = useT();
  const { nickname } = useSocial();
  const c = useCommunity();
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState<CommunityTopic>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [wantsExpert, setWantsExpert] = useState(false);
  const [name, setName] = useState(nickname);
  const [error, setError] = useState("");

  async function submit() {
    const problem = checkPost(title, body);
    if (problem) return setError(t(problem));
    if (!anonymous) {
      const n = name.trim();
      if (n.length < 3) return setError(t("Choose a nickname of at least 3 letters, or post anonymously."));
    }
    setBusy(true);
    let postId: string;
    try {
      // On the shared Community the server checks the same rules again
      postId = await c.createPost({ topic, title, body, anonymous, name, wantsExpert });
    } catch (e) {
      setBusy(false);
      return setError(t((e as Error).message));
    }
    setBusy(false);
    setTitle("");
    setBody("");
    setWantsExpert(false);
    onClose();
    showToast(t("Posted"));
    router.push(`/social/post/${postId}`);
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("Ask the community")}>
      <div className="max-h-[70dvh] space-y-3 overflow-y-auto pr-1">
        <div>
          <p className="text-xs text-ink-soft">{t("Topic")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {COMMUNITY_TOPICS.map((x) => (
              <button
                key={x.id}
                aria-pressed={topic === x.id}
                onClick={() => setTopic(x.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  topic === x.id ? "bg-forest text-white" : "ring-1 ring-line"
                }`}
              >
                {t(x.label)}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-xs text-ink-soft">
          {t("Your question")}
          <input
            value={title}
            maxLength={LIMITS.titleMax}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            placeholder={t("How do you deal with nerves with a new partner?")}
            className="mt-1 w-full rounded-2xl px-4 py-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
        </label>

        <label className="block text-xs text-ink-soft">
          {t("Details (optional)")}
          <textarea
            value={body}
            maxLength={LIMITS.bodyMax}
            rows={3}
            onChange={(e) => {
              setBody(e.target.value);
              setError("");
            }}
            placeholder={t("Share only what you're comfortable with.")}
            className="mt-1 w-full resize-none rounded-2xl px-4 py-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-2xl bg-mint/50 px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-forest-deep">{t("Post anonymously")}</span>
            <span className="block text-[11px] text-forest">{t("No name or number is shown.")}</span>
          </span>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-5 w-5 accent-[var(--forest)]"
          />
        </label>

        {!anonymous && (
          <label className="block text-xs text-ink-soft">
            {t("Nickname")}
            <input
              value={name}
              maxLength={24}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Baraka_DSM"
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
            />
            <span className="mt-1 block text-[11px]">{t("Don't use your real full name.")}</span>
          </label>
        )}

        <label className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-line">
          <span>
            <span className="block text-sm font-semibold">{t("Ask for an expert answer")}</span>
            <span className="block text-[11px] text-ink-soft">
              {t("Verified professionals aren't available yet. Your question will be queued for when they join.")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={wantsExpert}
            onChange={(e) => setWantsExpert(e.target.checked)}
            className="h-5 w-5 accent-[var(--forest)]"
          />
        </label>

        <p className="flex items-start gap-1.5 text-[11px] text-ink-soft">
          <Lock size={12} className="mt-px shrink-0" />
          {t("Your Man tab records and check-ins are never shared here. No phone numbers, links or selling.")}
        </p>
        {error && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line">
          {t("Cancel")}
        </button>
        <button onClick={submit} disabled={busy} className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {t("Post")}
        </button>
      </div>
    </Sheet>
  );
}
