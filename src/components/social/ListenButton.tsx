"use client";

// Step 90: "Listen" on a card. The phone reads the card aloud in his language (free, offline, nothing uploaded).
// Tap again to stop. Hidden where the phone can't speak (some in-app browsers).

import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { useToast } from "@/components/motion/Toast";
import { canSpeak, cardSpeech, speak, stopSpeaking, useSpeaking } from "@/lib/media/speak";
import type { ActionSpec, ContentItem } from "@/lib/content/types";
import { useT } from "@/lib/i18n";

export default function ListenButton({ item, spec, big = false }: { item: ContentItem; spec?: ActionSpec; big?: boolean }) {
  const t = useT();
  const showToast = useToast();
  const speaking = useSpeaking() === item.id;
  const [can, setCan] = useState(false);
  useEffect(() => setCan(canSpeak()), []);
  // Leaving the card's page stops the voice
  useEffect(() => () => (speaking ? stopSpeaking() : undefined), [speaking]);
  if (!can) return null;
  const sw = t.lang === "sw";
  const go = async () => {
    if (speaking) return stopSpeaking();
    const r = await speak(item.id, cardSpeech(item, spec, sw), sw ? "sw" : "en", sw ? cardSpeech(item, spec, false) : undefined);
    if (r === "no-sw-voice") showToast(t("Your phone has no Kiswahili voice yet, so it's reading in English. Add one in the phone's Settings → Text-to-speech."));
  };
  if (big) {
    return (
      <button
        type="button"
        onClick={go}
        aria-pressed={speaking}
        className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold ring-1 transition-transform active:scale-95 ${speaking ? "bg-forest text-white ring-forest" : "text-forest ring-line"}`}
      >
        {speaking ? <Square size={15} fill="currentColor" /> : <Volume2 size={16} />} {t(speaking ? "Stop" : "Listen")}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label={t(speaking ? "Stop reading" : "Listen")}
      aria-pressed={speaking}
      onClick={go}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90 ${speaking ? "bg-forest text-white" : "text-ink"}`}
    >
      {speaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={22} />}
    </button>
  );
}
