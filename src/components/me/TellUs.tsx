"use client";

// "Tell us" on Me (Step 85): one line about the app, and an optional 1–5 rating. The team reads it in
// Studio → Feedback. Signed-in men only; at most 5 a day (checked by the database, migration 0018).
// What he writes goes to the team, nowhere else; no health records are attached.

import { useState } from "react";
import { MessageSquareHeart, Star } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { appPlatform } from "@/lib/analytics/track";
import { currentLang } from "@/lib/me/lang";
import { useToast } from "@/components/motion/Toast";
import { haptic } from "@/lib/motion/haptics";
import { useT } from "@/lib/i18n";

export default function TellUs() {
  const t = useT();
  const showToast = useToast();
  const [text, setText] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // Step 86: he may let us share it as a story, without his name (off unless he ticks it)
  const [shareOk, setShareOk] = useState(false);

  async function send() {
    const sb = getSupabase();
    if (!sb || text.trim().length < 2) return;
    setBusy(true);
    const args = { p_message: text.trim(), p_rating: rating, p_place: "me", p_lang: currentLang(), p_platform: appPlatform() };
    let { error } = await sb.rpc("feedback_send", shareOk ? { ...args, p_share_ok: true } : args);
    // Database not updated to 0019 yet: send it without the story permission
    if (error && shareOk && /feedback_send|function/i.test(error.message)) ({ error } = await sb.rpc("feedback_send", args));
    setBusy(false);
    if (error) {
      // The database's own message for "5 a day"; anything else (offline, not updated yet): try later
      showToast(/5 messages today/.test(error.message) ? t("Thank you! You've sent 5 today. Send more tomorrow.") : t("Couldn't send just now. Try again in a moment."));
      return;
    }
    haptic("success");
    setSent(true);
    setText("");
    setRating(null);
    setShareOk(false);
  }

  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center gap-3">
        <MessageSquareHeart size={18} className="shrink-0 text-forest" />
        <div>
          <p className="font-semibold">{t("Tell us")}</p>
          <p className="text-xs text-ink-soft">{t("What should we fix or add? The Men's Social team reads every message.")}</p>
        </div>
      </div>

      {sent ? (
        <div className="mt-4 rounded-2xl bg-mint/60 px-4 py-3 text-sm text-forest-deep">
          <p className="font-semibold">{t("Asante! We got it.")}</p>
          <button onClick={() => setSent(false)} className="mt-1 text-xs font-semibold underline">
            {t("Send another")}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label={t("How do you like the app?")}>
            <span className="mr-2 text-xs text-ink-soft">{t("How do you like the app?")}</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n}/5`}
                onClick={() => setRating(rating === n ? null : n)}
                className="flex h-9 w-9 items-center justify-center rounded-full"
              >
                <Star size={22} className={rating !== null && n <= rating ? "text-honey" : "text-line"} fill={rating !== null && n <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("E.g. the reels are slow on my phone, or: add a guide about…")}
            className="mt-3 w-full resize-none rounded-2xl bg-bg px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-forest"
          />
          <label className="mt-2 flex items-start gap-2.5 text-xs text-ink-soft">
            <input type="checkbox" checked={shareOk} onChange={(e) => setShareOk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--forest)]" />
            <span>{t("If this is a story of what worked for you, you may share it with other men, without my name.")}</span>
          </label>
          <button
            onClick={send}
            disabled={busy || text.trim().length < 2}
            className="mt-3 w-full rounded-full bg-forest py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? t("Sending…") : t("Send to the team")}
          </button>
        </>
      )}
    </section>
  );
}
