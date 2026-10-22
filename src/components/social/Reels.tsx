"use client";

// Reels on Discover (Step 70), like Instagram Reels:
//  - ReelsStrip: a row of tall video tiles near the top of Discover.
//  - ReelPost: a reel inside the feed, playing silently while it's on screen.
//  - ReelsViewer: full screen, swipe up for the next one. Tap for sound. Like, save, share, "I did it".
// Only the reel on screen (and the next one) loads, to save his data. Late at night, or after 15 reels,
// a "that's enough for tonight" card comes up (see lib/content/reels.ts).

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, Bookmark, Check, Clapperboard, Heart, Moon, Play, Send, Volume2, VolumeX, X } from "lucide-react";
import { contentHref } from "./ContentCards";
import { useToast } from "@/components/motion/Toast";
import { trackContent } from "@/lib/analytics/track";
import { reelCaption, softEndIndex } from "@/lib/content/reels";
import type { ContentItem } from "@/lib/content/types";
import { socialStore, useSocial } from "@/lib/social/store";
import { triedStore, useTried } from "@/lib/social/tried";
import { useT } from "@/lib/i18n";
import { habitsStore } from "@/lib/social/discoverPrefs";

const SOUND_KEY = "ms_reels_sound";
const saveData = () => {
  try {
    return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  } catch {
    return false;
  }
};

/* ───────── Row of tiles ───────── */
export function ReelsStrip({ reels, onOpen }: { reels: ContentItem[]; onOpen: (i: number) => void }) {
  const t = useT();
  const sw = t.lang === "sw";
  const seen = useSocial().history;
  if (!reels.length) return null;
  return (
    <section aria-labelledby="reels-h" className="-mx-5 lg:mx-0">
      <h2 id="reels-h" className="flex items-center gap-2 px-5 font-display text-[1.25rem] font-bold leading-tight lg:px-0">
        <Clapperboard size={20} className="text-forest" /> {t("Reels")}
      </h2>
      <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto px-5 pb-1 lg:px-0">
        {reels.slice(0, 12).map((r, i) => (
          <button
            key={r.id}
            onClick={() => onOpen(i)}
            className="group relative aspect-[9/16] w-[7.25rem] shrink-0 overflow-hidden rounded-2xl bg-forest-deep text-left ring-1 ring-line transition-transform active:scale-[0.97]"
            aria-label={sw && r.titleSw ? r.titleSw : r.title}
          >
            <Poster reel={r} />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            {!seen[r.id] && <span className="absolute left-2 top-2 rounded-full bg-honey px-2 py-0.5 text-[0.625rem] font-bold text-on-honey">{t("New")}</span>}
            <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
              <Play size={13} fill="currentColor" />
            </span>
            <span className="absolute inset-x-2 bottom-2 line-clamp-3 text-[0.75rem] font-semibold leading-tight text-white">{sw && r.titleSw ? r.titleSw : r.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The reel's picture: its cover photo, or the video's first frame. */
function Poster({ reel }: { reel: ContentItem }) {
  if (reel.coverImageUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={reel.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />;
  return <video src={`${reel.videoUrl}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" aria-hidden />;
}

/* ───────── A reel in the feed ───────── */
export function ReelPost({ reel, onOpen }: { reel: ContentItem; onOpen: () => void }) {
  const t = useT();
  const sw = t.lang === "sw";
  const box = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  // Plays silently only while it's on screen (and not when the phone is saving data)
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined" || saveData()) return;
    const io = new IntersectionObserver(([e]) => setOn(e.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (on) void v.play().catch(() => {});
    else v.pause();
  }, [on]);

  return (
    <article className="overflow-hidden rounded-[20px] bg-surface ring-1 ring-line">
      <header className="flex items-center gap-2.5 px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-white">
          <Clapperboard size={15} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-bold leading-tight">{t("Reel")}</p>
          <p className="truncate text-[0.6875rem] text-ink-soft">{reel.origin ? "@kayaniherbs" : "Kayani Herbs"}</p>
        </div>
      </header>
      <button ref={box} onClick={onOpen} className="relative block aspect-[4/5] w-full overflow-hidden bg-black" aria-label={t("Watch")}>
        {on ? (
          <video ref={video} src={reel.videoUrl} muted loop playsInline preload="metadata" poster={reel.coverImageUrl} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Poster reel={reel} />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[0.6875rem] font-bold text-white backdrop-blur">
          <VolumeX size={12} /> {t("Tap to watch")}
        </span>
        <span className="absolute inset-x-0 bottom-0 p-4 text-left text-white">
          <span className="block font-display text-[1.25rem] font-bold leading-tight">{sw && reel.titleSw ? reel.titleSw : reel.title}</span>
          {reelCaption(reel, sw) && (
            <span className="mt-1 line-clamp-2 block text-[0.8125rem] text-white/85">{reelCaption(reel, sw)}</span>
          )}
        </span>
      </button>
    </article>
  );
}

/* ───────── Full screen ───────── */
export function ReelsViewer({ reels, start, onClose }: { reels: ContentItem[]; start: number; onClose: () => void }) {
  const t = useT();
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  const [sound, setSound] = useState(() => {
    try {
      return sessionStorage.getItem(SOUND_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [endDismissed, setEndDismissed] = useState(false);
  const endAt = useMemo(() => (endDismissed ? -1 : softEndIndex(start, reels.length, new Date())), [endDismissed, start, reels.length]);

  // The phone's Back button closes the reels instead of leaving the app
  const closing = useRef(false);
  useEffect(() => {
    history.pushState({ reels: true }, "");
    const onPop = () => {
      closing.current = true;
      onClose();
    };
    window.addEventListener("popstate", onPop);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = useCallback(() => {
    if (!closing.current) history.back();
    else onClose();
  }, [onClose]);

  // Start at the reel he tapped
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-slide="r${start}"]`);
    el?.scrollIntoView({ block: "start" });
  }, [start]);

  // Which slide is on screen
  useEffect(() => {
    const root = strip.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
          const key = (e.target as HTMLElement).dataset.slide ?? "";
          if (key.startsWith("r")) setActive(Number(key.slice(1)));
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll("[data-slide]").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [reels.length, endAt]);

  const toggleSound = () => {
    setSound((s) => {
      try {
        sessionStorage.setItem(SOUND_KEY, s ? "0" : "1");
      } catch {}
      return !s;
    });
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black text-white" role="dialog" aria-modal="true" aria-label={t("Reels")}>
      <div ref={strip} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {reels.map((r, i) => (
          <Fragment key={r.id}>
            {i === endAt && (
              <section data-slide="end" className="relative flex h-[100dvh] snap-start flex-col items-center justify-center gap-4 px-8 text-center">
                <Moon size={40} className="text-mint" />
                <p className="font-display text-2xl font-bold">{t("That's enough for tonight")}</p>
                <p className="max-w-xs text-sm text-white/75">{t("Put the phone down and rest. Your next reels will be here tomorrow.")}</p>
                <button onClick={close} className="mt-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-forest-deep">
                  {t("Close reels")}
                </button>
                <button
                  onClick={() => {
                    setEndDismissed(true);
                    requestAnimationFrame(() => strip.current?.querySelector<HTMLElement>(`[data-slide="r${i}"]`)?.scrollIntoView({ behavior: "smooth" }));
                  }}
                  className="text-xs font-semibold text-white/60 underline underline-offset-4"
                >
                  {t("Keep watching")}
                </button>
              </section>
            )}
            <ReelSlide
              reel={r}
              index={i}
              active={i === active}
              near={Math.abs(i - active) <= 1}
              sound={sound}
              onToggleSound={toggleSound}
              onLeave={() => {
                closing.current = true;
                onClose();
              }}
            />
          </Fragment>
        ))}
        <section data-slide="done" className="flex h-[100dvh] snap-start flex-col items-center justify-center gap-3 px-8 text-center">
          <Check size={36} className="text-mint" />
          <p className="font-display text-xl font-bold">{t("You've watched them all")}</p>
          <p className="text-sm text-white/70">{t("New reels come every week.")}</p>
          <button onClick={close} className="mt-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-forest-deep">
            {t("Back to Discover")}
          </button>
        </section>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={close} aria-label={t("Close")} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur">
          <X size={20} />
        </button>
        <p className="font-display text-lg font-bold drop-shadow">{t("Reels")}</p>
        <button onClick={toggleSound} aria-label={t(sound ? "Sound off" : "Sound on")} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur">
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function ReelSlide({
  reel,
  index,
  active,
  near,
  sound,
  onToggleSound,
  onLeave,
}: {
  reel: ContentItem;
  index: number;
  active: boolean;
  near: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onLeave: () => void;
}) {
  const t = useT();
  const sw = t.lang === "sw";
  const showToast = useToast();
  const tried = useTried();
  const social = useSocial();
  const video = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [more, setMore] = useState(false);
  const liked = Boolean(tried.liked[reel.id]);
  const done = Boolean(tried.done[reel.id]);
  const saved = Boolean(social.bookmarks[reel.id]);
  const title = sw && reel.titleSw ? reel.titleSw : reel.title;
  const caption = reelCaption(reel, sw);

  // How much of it he watched (for the reels/reading mix, Step 71): counted when he moves on
  const watched = useRef({ seconds: 0, max: 0, on: false });
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (active) {
      v.currentTime = 0;
      void v.play().catch(() => {});
      socialStore.recordOpen(reel.id);
      trackContent(reel.id, "view");
      watched.current = { seconds: 0, max: 0, on: true };
    } else {
      v.pause();
      if (watched.current.on) {
        habitsStore.reelWatched(watched.current.seconds, watched.current.max);
        watched.current.on = false;
      }
    }
  }, [active, reel.id]);
  // Closing the reels counts the one on screen too
  useEffect(
    () => () => {
      if (watched.current.on) habitsStore.reelWatched(watched.current.seconds, watched.current.max);
    },
    [],
  );
  useEffect(() => {
    if (video.current) video.current.muted = !sound;
  }, [sound]);

  const share = async () => {
    const url = `${location.origin}${contentHref(reel.id)}`;
    try {
      if (navigator.share) return void (await navigator.share({ title, url }));
      await navigator.clipboard.writeText(url);
      showToast(t("Link copied"));
    } catch {}
  };

  return (
    <section data-slide={`r${index}`} className="relative h-[100dvh] snap-start overflow-hidden bg-black">
      {near ? (
        <video
          ref={video}
          src={reel.videoUrl}
          poster={reel.coverImageUrl}
          muted={!sound}
          loop
          playsInline
          preload={active ? "auto" : "metadata"}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            const f = v.duration ? v.currentTime / v.duration : 0;
            setProgress(f);
            if (active) {
              watched.current.seconds = Math.max(watched.current.seconds, v.currentTime);
              // It loops: once it has played through, it counts as finished
              watched.current.max = Math.max(watched.current.max, f, v.played.length && v.played.end(v.played.length - 1) >= v.duration - 0.5 ? 1 : 0);
            }
          }}
          onEnded={() => trackContent(reel.id, "complete")}
          onClick={onToggleSound}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        reel.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/30" />

      {/* Buttons on the right, like Reels */}
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-5 pb-[env(safe-area-inset-bottom)]">
        <RailButton label={t(liked ? "Helped ✓" : "This helped")} onClick={() => triedStore.toggleLike(reel.id)}>
          <Heart size={28} className={liked ? "text-red-500" : ""} fill={liked ? "currentColor" : "none"} />
        </RailButton>
        <RailButton
          label={t(saved ? "Saved" : "Save")}
          onClick={() => {
            const now = socialStore.toggleBookmark(reel.id);
            if (now) trackContent(reel.id, "save");
            showToast(t(now ? "Saved for later" : "Removed from saved"));
          }}
        >
          <Bookmark size={26} fill={saved ? "currentColor" : "none"} />
        </RailButton>
        <RailButton label={t("Share")} onClick={share}>
          <Send size={25} />
        </RailButton>
        <RailButton
          label={t(done ? "Done ✓" : "I did it")}
          onClick={() => {
            const now = triedStore.toggleDone(reel.id);
            if (now) {
              trackContent(reel.id, "complete");
              showToast(t("Nice one, bro. Keep going."));
            }
          }}
        >
          <Check size={27} className={done ? "text-mint" : ""} strokeWidth={done ? 3 : 2} />
        </RailButton>
      </div>

      {/* Caption */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-20">
        <p className="text-[0.8125rem] font-bold text-white/90">{reel.origin ? "@kayaniherbs" : "Kayani Herbs"}</p>
        <p className="mt-1 font-display text-[1.125rem] font-bold leading-snug">{title}</p>
        {caption && (
          <button onClick={() => setMore((m) => !m)} className={`mt-1 block text-left text-[0.875rem] leading-snug text-white/85 ${more ? "" : "line-clamp-2"}`}>
            {caption}
          </button>
        )}
        <Link href={contentHref(reel.id)} onClick={onLeave} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold backdrop-blur">
          {t("Full page")} <ArrowRight size={13} />
        </Link>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20">
        <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
      </div>
    </section>
  );
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex flex-col items-center gap-1 text-white drop-shadow transition-transform active:scale-90">
      {children}
      <span className="max-w-[4.5rem] text-center text-[0.625rem] font-semibold leading-tight">{label}</span>
    </button>
  );
}
