// Shape of every piece of educational content in Men's Social.
// Today: sample items in library.ts. Later: rows in the Content Studio (admin) / database.

export type TopicId = "erection" | "ejaculation" | "libido" | "fertility" | "confidence" | "intimacy" | "wellbeing";

export type ContentKind = "guide" | "article" | "video" | "quiz" | "tool" | "expert" | "audio" | "infographic" | "reel";

export type ToolId = "pelvic-floor" | "doctor-check";

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index of the correct option
  explain: string;
}

export interface ContentItem {
  id: string;
  kind: ContentKind;
  topic: TopicId;
  title: string;
  /** What he gains from it, in one or two short sentences. */
  summary: string;
  minutes: number;
  /** Editorial priority 0–100: higher is more likely to be featured. */
  priority: number;
  tags: string[];
  /** Paragraphs. A paragraph starting with "## " is shown as a heading. */
  body?: string[];
  keyPoints?: string[];
  question?: string; // expert answers
  quiz?: QuizQuestion[];
  tool?: ToolId;
  /** Who wrote it and its review state — always shown to the reader. */
  source: string;
  review: "draft" | "reviewed";
  /** true = development sample, to be replaced by real content from the Content Studio. */
  fixture: boolean;
  /** Shown as a daily lesson on the Man tab too. */
  inManFeed?: boolean;
  points?: number;
  cover: { tone: "forest" | "night" | "mint" | "sand" | "clay"; motif: "rings" | "waves" | "arc" | "grid" | "dots" };
  /** Kiswahili version of the body (same "## " heading rule). */
  bodySw?: string[];
  titleSw?: string;
  /** Kiswahili summary (Content Studio). */
  summarySw?: string;
  /** Where the content was adapted from, e.g. a Kayani Herbs Instagram post. */
  origin?: { platform: "instagram"; url: string; postedAt: string; format: "reel" | "post" | "carousel" };
  /** Pinned by staff as the Featured card at the top of Discover (Content Studio). */
  featured?: boolean;
  /** A real video to play (uploaded in the Content Studio, or a link to an .mp4). */
  videoUrl?: string;
  /** An audio file to play (audio lessons, podcasts). */
  audioUrl?: string;
  /** When it went live (set by the database). */
  publishedAt?: string;
  /** Goes live at this time (Content Studio scheduling). */
  publishAt?: string;
  /** Note between writer and editor during review. */
  reviewNote?: string;
  /** Drafted with AI help (for the Studio's records; it can be published straight away). */
  aiGenerated?: boolean;
  /** Uploaded cover photo (Content Studio). When set, it replaces the drawn cover. */
  coverImageUrl?: string;
  /** Content Studio fields */
  status?: ContentStatus;
  updatedAt?: string;
  /** true = shipped with the app (catalog files), false/undefined = from the database */
  builtIn?: boolean;
  /** Set on "do this" cards (actions.ts): steps, ingredients and timing for the Discover feed. */
  action?: ActionSpec;
}

export type ContentStatus = "draft" | "review" | "published" | "archived";

/** The challenges a man picks at the top of Discover. */
export type ChallengeId = "last" | "hard" | "her" | "mixes" | "train" | "reset" | "desire";
export type ActionType = "technique" | "position" | "mix" | "exercise" | "food" | "habit" | "mind";
/** When he can expect to feel it. */
export type ActionResult = "tonight" | "days" | "weeks2" | "weeks4" | "daily";

/** One swipeable slide of an action card: a step, a position, a rule. */
export interface ActionSlide {
  title?: string;
  titleSw?: string;
  text: string;
  textSw: string;
}

/** A "do this" card on Discover: something he can apply and feel, not just read. */
export interface ActionSpec {
  type: ActionType;
  challenges: ChallengeId[];
  results: ActionResult;
  /** Ingredients or things to have ready. */
  need?: string[];
  needSw?: string[];
  steps: ActionSlide[];
  why?: string;
  whySw?: string;
  /** Opens a built-in tool from the card (e.g. the pelvic floor timer). */
  tool?: "pelvic-floor";
  /* ── Step 86: hooks ── */
  /** Question-first card: a question (tap for the answer) or a true/false (he guesses first). */
  ask?: CardAsk;
  /** Part of a series ("5 nights to last longer"): the next part opens the day after he does this one. */
  series?: CardSeries;
  /** A "try it for N days" challenge he can start from this card. */
  challengeDays?: ChallengeDays;
  /** A safe, plain title for sharing on WhatsApp (nothing private on a friend's lock screen). */
  shareTitle?: string;
  shareTitleSw?: string;
}

export type ChallengeDays = 3 | 5 | 7;

export interface CardAsk {
  kind: "question" | "truefalse";
  q: string;
  qSw: string;
  /** The answer, or the explanation after he guesses. */
  a: string;
  aSw: string;
  /** truefalse only: is the statement true? */
  truth?: boolean;
}

export interface CardSeries {
  /** Same id = same series (made from the English name). */
  id: string;
  name: string;
  nameSw: string;
  /** 1, 2, 3… */
  part: number;
  /** One line about the next part, shown at the end of this one ("Tomorrow: the breathing trick"). */
  tease?: string;
  teaseSw?: string;
}

export interface Topic {
  id: TopicId;
  title: string;
  short: string;
}
