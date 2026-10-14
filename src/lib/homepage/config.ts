// The Discover page layout that staff publish from Admin → Homepage (table homepage_configs).
// The app reads the live layout; anything missing or invalid falls back to the normal Discover page.
// Personalization stays: editor picks come first, then each man's own recommendations fill the rest.

import { featuredToday, FEATURABLE, questionToday, quickVideos, recommendations, topicTiles, dayNumber, type Personal, type Recommendation } from "../content/select";
import type { ContentItem } from "../content/types";

export type SectionId = "featured" | "for_you" | "videos" | "question" | "topics";
export type Words = { en?: string; sw?: string };

export interface SectionConfig {
  id: SectionId;
  visible: boolean;
  title?: Words;
  subtitle?: Words;
  /** Content ids (or, for topics, topic/format ids) chosen by staff, in order */
  items?: string[];
  /** How many to show (For you, Quick learning) */
  count?: number;
}

export interface HomepageConfig {
  version: 1;
  sections: SectionConfig[];
}

export const SECTION_IDS: SectionId[] = ["featured", "for_you", "videos", "question", "topics"];

export const SECTION_INFO: Record<SectionId, { name: string; what: string; kinds?: string[]; countRange?: [number, number]; defaultCount?: number }> = {
  featured: { name: "Featured insight", what: "The big card at the top. Pick one or more items; several take turns, one per day. Empty = chosen automatically (pinned items first).", kinds: FEATURABLE },
  for_you: { name: "For you", what: "Your picks show first; the rest are chosen for each man from the topics he follows and what he reads.", kinds: ["guide", "article", "infographic", "quiz", "tool", "audio"], countRange: [1, 5], defaultCount: 3 },
  videos: { name: "Quick learning", what: "Short videos. Pick specific ones, or leave empty to show his best matches.", kinds: ["video", "audio"], countRange: [1, 4], defaultCount: 2 },
  question: { name: "A question men often ask", what: "An expert answer. Pick several and they take turns daily; empty = chosen for him.", kinds: ["expert"] },
  topics: { name: "Explore all topics", what: "The topic tiles. Pick which tiles show and in what order; empty = all of them." },
};

export const DEFAULT_CONFIG: HomepageConfig = {
  version: 1,
  sections: SECTION_IDS.map((id) => ({ id, visible: true })),
};

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const words = (v: unknown, max: number): Words | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const w = { en: str(o.en, max), sw: str(o.sw, max) };
  return w.en || w.sw ? w : undefined;
};

/** Makes any stored layout safe to use: unknown sections dropped, missing ones added (visible), values bounded. */
export function normalizeConfig(raw: unknown): HomepageConfig {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { sections?: unknown }).sections) ? ((raw as { sections: unknown[] }).sections) : [];
  const seen = new Set<SectionId>();
  const sections: SectionConfig[] = [];
  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const id = o.id as SectionId;
    if (!SECTION_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    const info = SECTION_INFO[id];
    const items = Array.isArray(o.items) ? [...new Set(o.items.filter((x): x is string => typeof x === "string" && /^[a-z0-9][a-z0-9-]{1,80}$/.test(x)))].slice(0, 20) : undefined;
    const count = info.countRange && typeof o.count === "number" ? Math.min(info.countRange[1], Math.max(info.countRange[0], Math.round(o.count))) : undefined;
    sections.push({
      id,
      visible: o.visible !== false,
      ...(words(o.title, 60) ? { title: words(o.title, 60) } : {}),
      ...(words(o.subtitle, 120) ? { subtitle: words(o.subtitle, 120) } : {}),
      ...(items?.length ? { items } : {}),
      ...(count ? { count } : {}),
    });
  }
  for (const id of SECTION_IDS) if (!seen.has(id)) sections.push({ id, visible: true });
  return { version: 1, sections };
}

/** Section words in his language, or the normal wording. */
export const wordsFor = (w: Words | undefined, lang: "en" | "sw") => (lang === "sw" ? w?.sw || w?.en : w?.en) || undefined;

/** What each section shows for this man today, following the layout. */
export function resolveDiscover(config: HomepageConfig, me: Personal, library: ContentItem[], day = dayNumber()) {
  const byId = new Map(library.map((c) => [c.id, c]));
  const sec = (id: SectionId) => config.sections.find((s) => s.id === id)!;
  const pick = (id: SectionId, kinds?: string[]) =>
    (sec(id).items ?? []).map((x) => byId.get(x)).filter((c): c is ContentItem => Boolean(c) && (!kinds || kinds.includes(c!.kind)));

  // Featured: staff picks rotate daily (unread first); otherwise the usual choice (pins, then best match)
  const featPicks = pick("featured", SECTION_INFO.featured.kinds);
  const unread = featPicks.filter((c) => !me.history[c.id]);
  const pool = unread.length ? unread : featPicks;
  const featured = pool.length ? pool[day % pool.length] : featuredToday(me, library, day);
  const exclude = featured ? [featured.id] : [];

  // For you: staff picks first, then his personal recommendations
  const fy = sec("for_you");
  const fyCount = fy.count ?? SECTION_INFO.for_you.defaultCount!;
  const staff: Recommendation[] = pick("for_you", SECTION_INFO.for_you.kinds)
    .filter((c) => !exclude.includes(c.id))
    .slice(0, fyCount)
    .map((item) => ({ item, reason: "Picked by our editors", why: { key: "Picked by our editors", topic: "" } }));
  const personal = recommendations(me, library, [...exclude, ...staff.map((r) => r.item.id)], Math.max(0, fyCount - staff.length));
  const forYou = [...staff, ...personal];

  // Quick learning
  const v = sec("videos");
  const vCount = v.count ?? SECTION_INFO.videos.defaultCount!;
  const vPicks = pick("videos", SECTION_INFO.videos.kinds).filter((c) => !exclude.includes(c.id));
  const videos = vPicks.length ? vPicks.slice(0, vCount) : quickVideos(me, library.filter((c) => !exclude.includes(c.id)), vCount);

  // Question: staff pool rotates daily
  const qPicks = pick("question", ["expert"]).filter((c) => c.question);
  const question = qPicks.length ? qPicks[day % qPicks.length] : questionToday(me, library.filter((c) => !exclude.includes(c.id)), day);

  // Topic tiles: staff order/selection
  const all = topicTiles(library);
  const t = sec("topics").items ?? [];
  const tiles = t.length ? t.map((id) => all.find((x) => x.id === id)).filter((x): x is (typeof all)[number] => Boolean(x)) : all;

  return { featured, forYou, videos, question, tiles };
}
