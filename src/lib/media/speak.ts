"use client";

// Step 90: "Listen" reads a card aloud with the phone's own voice (free, works offline, nothing is uploaded).
// Kiswahili uses a Kiswahili voice when the phone has one; if not, he's told how to add one and it reads in English.
// Only one thing speaks at a time.

import { useSyncExternalStore } from "react";
import type { ActionSpec, ContentItem } from "../content/types";

/** The words to read for a card: title, opening line, what you need, the steps, the secret. Pure, so it's tested. */
export function cardSpeech(
  item: Pick<ContentItem, "title" | "titleSw" | "summary" | "summarySw"> & Partial<Pick<ContentItem, "body" | "bodySw">>,
  spec: ActionSpec | undefined,
  sw: boolean,
): string[] {
  const out: string[] = [];
  const title = sw && item.titleSw ? item.titleSw : item.title;
  const hook = sw && item.summarySw ? item.summarySw : item.summary;
  out.push(title);
  if (hook) out.push(hook);
  if (spec) {
    const need = sw ? spec.needSw : spec.need;
    if (need?.length) out.push(`${sw ? "Mahitaji" : "You need"}: ${need.join(", ")}.`);
    spec.steps.forEach((s, i) => {
      const t = sw ? s.titleSw : s.title;
      out.push(`${sw ? "Hatua" : "Step"} ${i + 1}. ${t ? `${t}. ` : ""}${sw ? s.textSw : s.text}`);
    });
    const why = sw ? spec.whySw : spec.why;
    if (why) out.push(`${sw ? "Siri yake" : "The secret"}: ${why}`);
  } else {
    // Articles and guides: the whole text (headings read as their own line)
    const body = (sw && item.bodySw?.length ? item.bodySw : item.body) ?? [];
    for (const p of body) out.push(p.replace(/^##\s*/, ""));
  }
  // Symbols the voice would read out oddly
  return out.map((s) => s.replace(/[•*#_]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** The best voice for a language ("sw" or "en"), or null. */
export function pickVoice<V extends Pick<SpeechSynthesisVoice, "lang" | "localService" | "name">>(voices: V[], lang: "sw" | "en"): V | null {
  const of = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith(lang));
  const pref = lang === "sw" ? ["sw-tz", "sw-ke", "sw"] : ["en-gb", "en-us", "en"];
  for (const p of pref) {
    const v = of.find((x) => x.lang.toLowerCase().replace("_", "-").startsWith(p) && x.localService) ?? of.find((x) => x.lang.toLowerCase().replace("_", "-").startsWith(p));
    if (v) return v;
  }
  return null;
}

let speakingId: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function voicesNow(): Promise<SpeechSynthesisVoice[]> {
  const v = speechSynthesis.getVoices();
  if (v.length) return Promise.resolve(v);
  return new Promise((ok) => {
    const done = () => ok(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200);
  });
}

/** Read these lines aloud. Returns "no-sw-voice" when Kiswahili was asked for but the phone has no Kiswahili voice:
 *  then the English lines are read instead (an English voice reading Kiswahili words is hard to follow). */
export async function speak(id: string, lines: string[], lang: "sw" | "en", englishLines?: string[]): Promise<"ok" | "no-sw-voice" | "unsupported"> {
  if (!canSpeak()) return "unsupported";
  stopSpeaking();
  const voices = await voicesNow();
  let voice = pickVoice(voices, lang);
  let result: "ok" | "no-sw-voice" = "ok";
  if (!voice && lang === "sw") {
    result = "no-sw-voice";
    if (englishLines?.length) lines = englishLines;
  }
  if (!voice) voice = pickVoice(voices, "en");
  speakingId = id;
  emit();
  lines.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = lang === "sw" ? "sw-TZ" : "en-GB";
    u.rate = 0.95;
    if (i === lines.length - 1) {
      u.onend = () => {
        if (speakingId === id) {
          speakingId = null;
          emit();
        }
      };
    }
    u.onerror = () => {
      if (speakingId === id) {
        speakingId = null;
        emit();
      }
    };
    speechSynthesis.speak(u);
  });
  return result;
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
  if (speakingId) {
    speakingId = null;
    emit();
  }
}

/** Which card is being read now (null = none). */
export function useSpeaking(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => speakingId,
    () => null,
  );
}
