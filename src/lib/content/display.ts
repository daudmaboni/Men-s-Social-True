// What a man sees for a piece of content in his language.
// Titles and text come from the Content Studio (Kiswahili when staff wrote one); labels come from the app's translations.

import type { T } from "../i18n/translate";
import { TOPICS } from "./library";
import { CTA_LABEL, KIND_LABEL } from "./select";
import type { ContentItem, TopicId } from "./types";

export const titleOf = (c: Pick<ContentItem, "title" | "titleSw">, t: Pick<T, "lang">) => (t.lang === "sw" && c.titleSw ? c.titleSw : c.title);
export const summaryOf = (c: Pick<ContentItem, "summary" | "summarySw">, t: Pick<T, "lang">) => (t.lang === "sw" && c.summarySw ? c.summarySw : c.summary);
export const kindOf = (c: Pick<ContentItem, "kind">, t: T) => t(KIND_LABEL[c.kind]);
export const ctaOf = (c: Pick<ContentItem, "kind">, t: T) => t(CTA_LABEL[c.kind]);
export const topicTitle = (id: TopicId | string, t: T) => t(TOPICS.find((x) => x.id === id)?.title ?? "");
export const topicShort = (id: TopicId | string, t: T) => t(TOPICS.find((x) => x.id === id)?.short ?? "");
/** "Guide · 4 min" */
export const metaOf = (c: Pick<ContentItem, "kind" | "minutes">, t: T) => `${kindOf(c, t)} · ${t("{n} min", { n: c.minutes })}`;
