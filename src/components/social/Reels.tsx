"use client";

// Reels on Discover, like Instagram Reels:
//  - ReelPost (Step 73): a full-width, tall reel inside the feed. It plays silently while it's the reel
//    most on screen (only one at a time, see lib/content/feedPlayer.ts) and pauses when he scrolls past.
//    Nothing is printed over the video, so the video's own text stays readable: the name, title, caption
//    and buttons sit under it. Tapping the video opens the full-screen viewer with sound on.
//  - ReelsViewer: full screen, swipe up for the next one. Like, save, share, "I did it".
// Only the reel on screen (and the next one) loads, to save his data. Late at night, or after 15 reels,
// a "that's enough for tonight" card comes up (see lib/content/reels.ts).

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, Bookmark, Check, Heart, Moon, Play, Send, Volume2, VolumeX, X } from "lucide-react";
import { contentHref } from "./ContentCards";
import { useToast } from "@/components/motion/Toast";
import BrandMark from "@/components/brand/BrandMark";
import { trackContent } from "@/lib/analytics/track";
import { reelCaption, softEndIndex } from "@/lib/content/reels";
import { feedPlayer, useFeedSound, usePlayingReel } from "@/lib/content/feedPlayer";
import { youtubeId, youtubeThumb } from "@/lib/content/youtube";
import { YouTubeFrame } from "@/components/media/YouTubeFrame";
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

/** The reel's picture: its cover photo, or the video's first frame. */
function Poster({ reel }: { reel: ContentItem }) {
  const yt = youtubeId(reel.videoUrl);
  if (reel.coverImageUrl || yt)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={reel.coverImageUrl || youtubeThumb(yt!)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />;
  return <video src={`${reel.videoUrl}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" aria-hidden />;
}

/* ───────── A reel in the feed ───────── */
export function ReelPost({ reel, onOpen }: { reel: ContentItem; onOpen: () => void }) {
  const t = useT();
  const sw = t.lang === "sw";
  const showToast = useToast();
  const tried = useTried();
  const social = useSocial();
  const key = `${reel.id}:${useId()}`;
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false); // any part on screen → load the video
  const [progress, setProgress] = useState(0);
  const [more, setMore] = useState(false);
  const playing = usePlayingReel() === key;
  const sound = useFeedSound();
  const liked = Boolean(tried.liked[reel.id]);
  const saved = Boolean(social.bookmarks[reel.id]);
  const title = sw && reel.titleSw ? reel.titleSw : reel.title;
  const caption = reelCaption(reel, sw);
  const handle = reel.origin ? "@kayaniherbs" : "Kayani Herbs";
  const lite = useMemo(() => saveData(), []);
  const yt = youtubeId(reel.videoUrl);

  // Tell the feed player how much of this reel is on screen
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting);
        if (!lite) feedPlayer.report(key, e.isIntersecting ? e.intersectionRatio : 0);
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      feedPlayer.leave(key);
    };
  }, [key, lite]);

  // Play only while this is the chosen reel; pause the moment it isn't
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) {
      v.muted = !sound;
      void v.play().catch(() => {
        // Sound without a tap can be blocked: fall back to silent
        if (!v.muted) {
          v.muted = true;
          feedPlayer.setSound(false);
          void v.play().catch(() => {});
        }
      });
    } else v.pause();
  }, [playing, near, sound]);

  const share = async () => {
    const url = `${location.origin}${contentHref(reel.id)}`;
    try {
      if (navigator.share) return void (await navigator.share({ title, url }));
      await navigator.clipboard.writeText(url);
      showToast(t("Link copied"));
    } catch {}
  };

  return (
    <article className="overflow-hidden rounded-[20px] bg-surface ring-1 ring-line">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <BrandMark size={32} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-bold leading-tight">{handle}</p>
          <p className="truncate text-[0.6875rem] text-ink-soft">{t("Reel")}</p>
        </div>
      </header>

      {/* The video, nothing written over it. Tall like Instagram, but never taller than the screen. */}
      <div ref={box} className="relative aspect-[9/16] max-h-[min(78svh,820px)] w-full overflow-hidden bg-black">
        {yt && near && !lite && (
          <YouTubeFrame id={yt} playing={playing} muted={!sound} loop title={title} className="absolute inset-0" onProgress={(c, d) => setProgress(c / d)} />
        )}
        <button type="button" onClick={onOpen} className="absolute inset-0 block h-full w-full" aria-label={`${t("Watch")}: ${title}`}>
          {yt && near && !lite ? null : near && !lite ? (
            <video
              ref={video}
              src={reel.videoUrl}
              poster={reel.coverImageUrl}
              muted
              loop
              playsInline
              preload="metadata"
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setProgress(v.duration ? v.currentTime / v.duration : 0);
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Poster reel={reel} />
          )}
          {lite && (
            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
              <Play size={24} fill="currentColor" />
            </span>
          )}
        </button>
        {!lite && (
          <button
            type="button"
            onClick={() => feedPlayer.setSound(!sound)}
            aria-label={t(sound ? "Sound off" : "Sound on")}
            className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur active:scale-90"
          >
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
          <div className="h-full bg-white/90" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* Buttons under the video, like Instagram */}
      <div className="flex items-center gap-1 px-1.5 pt-1.5">
        <IconButton label={t(liked ? "Helped ✓" : "This helped")} onClick={() => triedStore.toggleLike(reel.id)}>
          <Heart size={24} className={liked ? "text-red-500" : ""} fill={liked ? "currentColor" : "none"} />
        </IconButton>
        <IconButton label={t("Share")} onClick={share}>
          <Send size={22} />
        </IconButton>
        <span className="flex-1" />
        <IconButton
          label={t(saved ? "Saved" : "Save")}
          onClick={() => {
            const now = socialStore.toggleBookmark(reel.id);
            if (now) trackContent(reel.id, "save");
            showToast(t(now ? "Saved for later" : "Removed from saved"));
          }}
        >
          <Bookmark size={23} fill={saved ? "currentColor" : "none"} />
        </IconButton>
      </div>

      <div className="px-3.5 pb-3.5">
        <p className="mt-0.5 text-[0.875rem] leading-snug">
          <span className="font-bold">{handle}</span> <span className="font-semibold">{title}</span>
        </p>
        {caption && (
          <button type="button" onClick={() => setMore((m) => !m)} className={`mt-0.5 block w-full text-left text-[0.8125rem] leading-snug text-ink-soft ${more ? "" : "line-clamp-2"}`}>
            {caption}
          </button>
        )}
      </div>
    </article>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform active:scale-90">
      {children}
    </button>
  );
}

/* ───────── Full screen ───────── */
export function ReelsViewer({ reels, start, onClose, withSound = false }: { reels: ContentItem[]; start: number; onClose: () => void; withSound?: boolean }) {
  const t = useT();
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  // Opened by tapping a reel → sound on (the tap allows it). Otherwise his last choice.
  const [sound, setSound] = useState(() => {
    if (withSound) return true;
    try {
      return sessionStorage.getItem(SOUND_KEY) === "1";
    } catch {
      return false;
    }
  });
  // The feed's reels stop while the viewer is open
  useEffect(() => {
    feedPlayer.setViewerOpen(true);
    return () => feedPlayer.setViewerOpen(false);
  }, []);
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
              onSoundBlocked={() => setSound(false)}
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
  onSoundBlocked,
  onLeave,
}: {
  reel: ContentItem;
  index: number;
  active: boolean;
  near: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onSoundBlocked: () => void;
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
  const yt = youtubeId(reel.videoUrl);
  useEffect(() => {
    const v = video.current;
    if (!v && !(yt && active)) {
      if (!active && watched.current.on) {
        habitsStore.reelWatched(watched.current.seconds, watched.current.max);
        watched.current.on = false;
      }
      return;
    }
    if (active) {
      if (v) v.currentTime = 0;
      if (v) void v.play().catch(() => {
        // Some phones block sound until he taps: play silently instead, and the sound button shows off
        if (!v.muted) {
          v.muted = true;
          onSoundBlocked();
          void v.play().catch(() => {});
        }
      });
      socialStore.recordOpen(reel.id);
      trackContent(reel.id, "view");
      watched.current = { seconds: 0, max: 0, on: true };
    } else {
      v?.pause();
      if (watched.current.on) {
        habitsStore.reelWatched(watched.current.seconds, watched.current.max);
        watched.current.on = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {near && yt ? (
        <>
          <YouTubeFrame
            id={yt}
            playing={active}
            muted={!sound}
            loop
            title={title}
            className="absolute inset-0"
            onProgress={(c, d) => {
              const f = c / d;
              setProgress(f);
              if (!active) return;
              const w = watched.current;
              // It loops: jumping back to the start after the end counts as finished
              if (w.seconds > d - 1.5 && c < 1) {
                if (w.max < 1) trackContent(reel.id, "complete");
                w.max = 1;
              }
              w.seconds = Math.max(w.seconds, c);
              w.max = Math.max(w.max, f);
            }}
          />
          <button type="button" onClick={onToggleSound} aria-label={t(sound ? "Sound off" : "Sound on")} className="absolute inset-0" />
        </>
      ) : near ? (
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
        (reel.coverImageUrl || yt) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reel.coverImageUrl || youtubeThumb(yt!)} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
