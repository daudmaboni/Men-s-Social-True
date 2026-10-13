import { Play } from "lucide-react";
import type { ContentItem } from "@/lib/content/types";

// Editorial cover art drawn in brand colours. Placeholder until real photography
// is uploaded through the Content Studio — then this is swapped for the image.

const TONES = {
  forest: { bg: "#0f5c46", a: "#1d7a5f", b: "#5dcaa5", c: "#dff3ea" },
  night: { bg: "#06261d", a: "#0f4a39", b: "#2f9d78", c: "#9fe1cb" },
  mint: { bg: "#dff3ea", a: "#bfe8d6", b: "#5dcaa5", c: "#0f5c46" },
  sand: { bg: "#f1e8d8", a: "#e3d3b5", b: "#c9a86d", c: "#6b4f22" },
  clay: { bg: "#efdcd0", a: "#e2bfa9", b: "#c98f6e", c: "#6e3519" },
} as const;

export default function Cover({
  item,
  className = "",
  showPlay = true,
}: {
  item: Pick<ContentItem, "cover" | "kind" | "id" | "coverImageUrl">;
  className?: string;
  showPlay?: boolean;
}) {
  const t = TONES[item.cover.tone];
  // small variation per item so covers with the same motif don't look identical
  const seed = [...item.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const shift = (seed % 40) - 20;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: t.bg }} aria-hidden="true">
      {item.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- images come from Supabase storage, any size
        <img src={item.coverImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {item.cover.motif === "rings" && (
          <g fill="none" strokeWidth="18">
            <circle cx={290 + shift} cy="120" r="150" stroke={t.a} />
            <circle cx={290 + shift} cy="120" r="100" stroke={t.b} opacity="0.7" />
            <circle cx={290 + shift} cy="120" r="50" stroke={t.c} opacity="0.85" />
          </g>
        )}
        {item.cover.motif === "waves" && (
          <g fill="none" strokeWidth="14" strokeLinecap="round">
            {[0, 1, 2, 3].map((i) => (
              <path
                key={i}
                d={`M-20 ${150 + i * 38} C 80 ${100 + i * 38 + shift}, 180 ${210 + i * 38}, 420 ${130 + i * 38}`}
                stroke={i % 2 ? t.b : t.a}
                opacity={1 - i * 0.12}
              />
            ))}
            <circle cx={320 + shift} cy="70" r="26" fill={t.c} stroke="none" />
          </g>
        )}
        {item.cover.motif === "arc" && (
          <g>
            <path d={`M-40 300 A 260 260 0 0 1 ${440 + shift} 300`} fill={t.a} />
            <path d={`M40 300 A 180 180 0 0 1 ${360 + shift} 300`} fill={t.b} opacity="0.8" />
            <circle cx={300 + shift} cy="70" r="34" fill={t.c} />
          </g>
        )}
        {item.cover.motif === "grid" && (
          <g>
            {Array.from({ length: 6 }).map((_, r) =>
              Array.from({ length: 8 }).map((__, c) => (
                <circle key={`${r}-${c}`} cx={40 + c * 48} cy={30 + r * 48} r="5" fill={t.a} />
              )),
            )}
            <rect x={210 + shift} y="80" width="150" height="150" rx="36" fill={t.b} opacity="0.85" />
            <rect x={250 + shift} y="120" width="70" height="70" rx="18" fill={t.c} />
          </g>
        )}
        {item.cover.motif === "dots" && (
          <g>
            <circle cx={90 + shift} cy="210" r="120" fill={t.a} />
            <circle cx={300} cy={90 + shift} r="70" fill={t.b} opacity="0.85" />
            <circle cx={330} cy="230" r="28" fill={t.c} />
            <circle cx={200 + shift} cy="60" r="12" fill={t.c} opacity="0.8" />
          </g>
        )}
      </svg>
      )}
      {showPlay && item.kind === "video" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-forest-deep shadow-lg">
            <Play size={20} fill="currentColor" />
          </span>
        </span>
      )}
    </div>
  );
}
