// Shape of every piece of educational content in Men's Social.
// Today: sample items in library.ts. Later: rows in the Content Studio (admin) / database.

export type TopicId = "erection" | "ejaculation" | "libido" | "confidence" | "intimacy" | "wellbeing";

export type ContentKind = "guide" | "article" | "video" | "quiz" | "tool" | "expert";

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
}

export interface Topic {
  id: TopicId;
  title: string;
  short: string;
}
