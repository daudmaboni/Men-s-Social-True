"use client";

// Kito's chat (Step 67). Used in the floating Kito window (KitoLauncher) and on the /social/kito page.
// He asks; Kito answers from Kayani's library and links the guides it used. When the library doesn't
// cover it, Kito says so. Members only; needs internet.
// The chat lives only in this browser tab (sessionStorage) — nothing is saved to his account or by Kayani.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, BookOpen, Headphones, Lock, RotateCcw, WifiOff, X } from "lucide-react";
import { useAccount } from "@/lib/account/useAccount";
import { askKito, KitoError, type KitoAnswer } from "@/lib/kito/client";
import type { Turn } from "@/lib/kito/prompt";
import { useOnline } from "@/lib/offline/online";
import { useT } from "@/lib/i18n";
import KitoMark from "./KitoMark";

type Msg = { role: "user"; text: string } | ({ role: "kito"; text: string; error?: boolean } & Partial<KitoAnswer>);
const KEY = "ms_kito_chat";

const STARTERS = {
  en: ["How can I last longer tonight?", "What can I eat for stronger erections?", "How do I do Kegel exercises?", "How do I warm her up?"],
  sw: ["Nifanye nini nidumu muda mrefu leo?", "Nile nini kwa nguvu za kiume?", "Zoezi la Kegel linafanywaje?", "Nimwandaeje mke wangu?"],
};

export default function KitoChat({ onClose, onNavigate }: { onClose?: () => void; onNavigate?: () => void }) {
  const t = useT();
  const lang = t.lang === "sw" ? "sw" : "en";
  const acc = useAccount();
  const online = useOnline();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) setMsgs(JSON.parse(saved) as Msg[]);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30)));
    } catch {}
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const history: Turn[] = msgs.filter((m) => !("error" in m && m.error)).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setText("");
    setBusy(true);
    try {
      const a = await askKito(question, lang, history);
      setMsgs((m) => [...m, { role: "kito", text: a.answer, sources: a.sources, confident: a.confident, flag: a.flag }]);
    } catch (e) {
      const msg = e instanceof KitoError ? e.message : "Kito couldn't answer. Try again.";
      setMsgs((m) => [...m, { role: "kito", text: t(msg), error: true }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  const signedIn = acc.status === "signedIn";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <KitoMark size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">Kito</h2>
          <p className="truncate text-xs text-ink-soft">{t("Answers from Kayani's guides and lessons")}</p>
        </div>
        {msgs.length > 0 && signedIn && (
          <button onClick={() => setMsgs([])} aria-label={t("New chat")} title={t("New chat")} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-line">
            <RotateCcw size={16} />
          </button>
        )}
        {onClose && (
          <button onClick={onClose} aria-label={t("Close")} className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-ink ring-1 ring-line">
            <X size={17} />
          </button>
        )}
      </header>

      {acc.status === "loading" ? (
        <div className="flex-1" />
      ) : !signedIn ? (
        <div className="flex flex-1 items-center justify-center p-5">
          <section className="w-full rounded-3xl bg-bg p-6 text-center ring-1 ring-line">
            <Lock className="mx-auto text-forest" size={24} />
            <p className="mt-2 font-semibold">{t("Kito is for members")}</p>
            <p className="mt-1 text-sm text-ink-soft">{t("Create a free account and ask anything about the guides, the course and your progress.")}</p>
            <Link href="/account?mode=signup&next=/social" onClick={onNavigate} className="mt-4 block rounded-full bg-forest py-3 text-sm font-bold text-white">
              {t("Create a free account")}
            </Link>
            <Link href="/account?mode=login&next=/social" onClick={onNavigate} className="mt-1 block py-2 text-sm font-semibold text-forest">
              {t("Log in")}
            </Link>
          </section>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
            {msgs.length === 0 && (
              <div className="rounded-3xl bg-bg p-4 ring-1 ring-line">
                <p className="font-semibold">{t("Habari kaka. What do you want to know?")}</p>
                <p className="mt-1 text-sm text-ink-soft">{t("I answer from Kayani's own guides and show you where to read more. If it's not in the library, I'll tell you.")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STARTERS[lang].map((s) => (
                    <button key={s} onClick={() => void send(s)} disabled={!online} className="rounded-full bg-mint px-3 py-1.5 text-left text-[0.8125rem] font-semibold text-forest-deep disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (m.role === "user" ? <UserBubble key={i} text={m.text} /> : <KitoBubble key={i} m={m} onNavigate={onNavigate} />))}
            {busy && (
              <div className="flex items-center gap-2">
                <KitoMark size={26} />
                <span className="flex gap-1 rounded-full bg-bg px-3 py-2.5 ring-1 ring-line" aria-label={t("Kito is thinking")}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-forest/60" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </span>
              </div>
            )}
          </div>

          {/* Question box */}
          <div className="shrink-0 border-t border-line px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
            {!online && (
              <p className="mb-2 flex items-center gap-2 rounded-2xl bg-bg px-3 py-2 text-xs text-ink-soft ring-1 ring-line">
                <WifiOff size={14} className="shrink-0 text-forest" />
                <span>
                  {t("Kito needs internet.")}{" "}
                  <Link href="/me/downloads" onClick={onNavigate} className="font-semibold text-forest">
                    {t("Your downloads still work.")}
                  </Link>
                </span>
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
              className="flex items-end gap-2 rounded-3xl bg-bg p-1.5 ring-1 ring-line focus-within:ring-2 focus-within:ring-forest"
            >
              <textarea
                ref={input}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                rows={1}
                maxLength={600}
                disabled={!online}
                placeholder={t("Ask Kito…")}
                aria-label={t("Your question")}
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-[0.9375rem] outline-none placeholder:text-ink-soft disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!online || busy || text.trim().length < 3}
                aria-label={t("Send")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-white transition-transform active:scale-95 disabled:opacity-40"
              >
                <ArrowUp size={18} />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[0.6875rem] text-ink-soft">{t("Kayani doesn't keep your questions.")}</p>
          </div>
        </>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line rounded-3xl rounded-br-lg bg-forest px-4 py-2.5 text-[0.9375rem] text-white">{text}</p>
    </div>
  );
}

function KitoBubble({ m, onNavigate }: { m: Extract<Msg, { role: "kito" }>; onNavigate?: () => void }) {
  const t = useT();
  const urgent = m.flag === "urgent" || m.flag === "crisis";
  return (
    <div className="flex items-start gap-2">
      <KitoMark size={26} />
      <div className={`min-w-0 max-w-[88%] rounded-3xl rounded-tl-lg bg-bg px-4 py-3 ring-1 ${urgent ? "ring-red-300 dark:ring-red-800" : m.error ? "ring-amber-300" : "ring-line"}`}>
        {!m.error && m.confident === false && !urgent && (
          <p className="mb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-soft">{t("Not in the library yet")}</p>
        )}
        <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed">{m.text}</p>
        {m.sources && m.sources.length > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-forest">{t(m.confident ? "From the library" : "Closest guides")}</p>
            <ul className="mt-1.5 space-y-1.5">
              {m.sources.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} onClick={onNavigate} className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:bg-mint">
                    {s.kind === "lesson" ? <Headphones size={15} className="shrink-0 text-forest" /> : <BookOpen size={15} className="shrink-0 text-forest" />}
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
