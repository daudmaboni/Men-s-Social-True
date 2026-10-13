"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { checkPost, COMMUNITY_TOPICS, LIMITS, type CommunityTopic } from "@/lib/social/community";
import { socialStore, useSocial } from "@/lib/social/store";

/** Ask a question. Anonymous by default. */
export default function ComposeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const showToast = useToast();
  const { nickname } = useSocial();
  const [topic, setTopic] = useState<CommunityTopic>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [wantsExpert, setWantsExpert] = useState(false);
  const [name, setName] = useState(nickname);
  const [error, setError] = useState("");

  function submit() {
    const problem = checkPost(title, body);
    if (problem) return setError(problem);
    if (!anonymous) {
      const n = name.trim();
      if (n.length < 3) return setError("Choose a nickname of at least 3 letters, or post anonymously.");
      socialStore.setNickname(n);
    }
    const post = socialStore.addPost({ topic, title, body, anonymous, wantsExpert });
    setTitle("");
    setBody("");
    setWantsExpert(false);
    onClose();
    showToast("Posted");
    router.push(`/social/post/${post.id}`);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ask the community">
      <div className="max-h-[70dvh] space-y-3 overflow-y-auto pr-1">
        <div>
          <p className="text-xs text-ink-soft">Topic</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {COMMUNITY_TOPICS.map((t) => (
              <button
                key={t.id}
                aria-pressed={topic === t.id}
                onClick={() => setTopic(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  topic === t.id ? "bg-forest text-white" : "ring-1 ring-line"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-xs text-ink-soft">
          Your question
          <input
            value={title}
            maxLength={LIMITS.titleMax}
            onChange={(e) => {
              setTitle(e.target.value);
              setError("");
            }}
            placeholder="How do you deal with nerves with a new partner?"
            className="mt-1 w-full rounded-2xl px-4 py-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
        </label>

        <label className="block text-xs text-ink-soft">
          Details (optional)
          <textarea
            value={body}
            maxLength={LIMITS.bodyMax}
            rows={3}
            onChange={(e) => {
              setBody(e.target.value);
              setError("");
            }}
            placeholder="Share only what you're comfortable with."
            className="mt-1 w-full resize-none rounded-2xl px-4 py-3 text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-2xl bg-mint/50 px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-forest-deep">Post anonymously</span>
            <span className="block text-[11px] text-forest">No name or number is shown.</span>
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
            Nickname
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
            <span className="mt-1 block text-[11px]">Don&apos;t use your real full name.</span>
          </label>
        )}

        <label className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-line">
          <span>
            <span className="block text-sm font-semibold">Ask for an expert answer</span>
            <span className="block text-[11px] text-ink-soft">
              Verified professionals aren&apos;t available yet. Your question will be queued for when they join.
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
          Your Man tab records and check-ins are never shared here. No phone numbers, links or selling.
        </p>
        {error && (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line">
          Cancel
        </button>
        <button onClick={submit} className="rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white">
          Post
        </button>
      </div>
    </Sheet>
  );
}
