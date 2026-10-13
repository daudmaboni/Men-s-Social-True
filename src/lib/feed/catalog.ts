// Starter content for the Home feed.
// This is CONTENT, not user data: it moves into the Content Studio (admin) later,
// where Daud can add, edit and schedule it. Point values are configurable there too.

import { LIBRARY } from "../content/library";
import type { ContentItem } from "../content/types";

export type Slot = "morning" | "afternoon" | "evening";

/** "tracker" activities complete themselves when the matching record exists. */
export type Tracker = "checkin" | "sleep" | "water";

export interface Activity {
  id: string;
  title: string;
  discreetTitle: string; // shown when discreet mode is on
  detail: string;
  points: number;
  slot: Slot | "any";
  tracker?: Tracker;
  why: string; // shown under "Why am I seeing this?"
}

export const ACTIVITIES: Activity[] = [
  {
    id: "checkin",
    title: "Energy and mood check-in",
    discreetTitle: "Daily check-in",
    detail: "Two taps. Helps you notice patterns over time.",
    points: 10,
    slot: "morning",
    tracker: "checkin",
    why: "A daily check-in is how you and the app learn what affects your energy.",
  },
  {
    id: "sleep",
    title: "Log last night's sleep",
    discreetTitle: "Log last night",
    detail: "Bedtime, wake-up time and how well you slept.",
    points: 10,
    slot: "morning",
    tracker: "sleep",
    why: "Sleep affects energy, mood and overall wellbeing, so it's worth tracking.",
  },
  {
    id: "water",
    title: "Reach your water goal",
    discreetTitle: "Water goal",
    detail: "Log glasses and bottles as you drink through the day.",
    points: 15,
    slot: "any",
    tracker: "water",
    why: "Staying hydrated supports energy and digestion. Your goal is set by you.",
  },
  {
    id: "walk",
    title: "Take a 20-minute walk",
    discreetTitle: "20-minute walk",
    detail: "Any pace that feels comfortable. Outside if you can.",
    points: 15,
    slot: "afternoon",
    why: "Regular walking supports circulation, mood and sleep.",
  },
  {
    id: "breathe",
    title: "5 minutes of slow breathing",
    discreetTitle: "5-minute breathing",
    detail: "Breathe in for 4 seconds, out for 6. Repeat for 5 minutes.",
    points: 10,
    slot: "evening",
    why: "Slow breathing is a simple way to calm stress at the end of the day.",
  },
  {
    id: "screens-off",
    title: "Screens off 30 minutes before bed",
    discreetTitle: "Screens off before bed",
    detail: "Put the phone away and let your mind slow down.",
    points: 10,
    slot: "evening",
    why: "Less screen time before bed can make it easier to fall asleep.",
  },
];

export interface Lesson {
  id: string;
  title: string;
  topic: string;
  minutes: number;
  summary: string;
  body: string[]; // paragraphs
  points: number;
}

// Daily lessons on the Man tab come from the shared content library (same items as in Discover).
const TOPIC_LABEL: Record<string, string> = {
  erection: "Erections",
  ejaculation: "Lasting longer",
  libido: "Desire",
  confidence: "Confidence",
  intimacy: "Intimacy",
  wellbeing: "Lifestyle",
};

/** Daily lessons for the Man tab: any content marked "show on Man tab" (built-in or published in the Studio). */
export function lessonsFrom(items: ContentItem[]): Lesson[] {
  return items
    .filter((c) => c.inManFeed)
    .map((c) => ({
      id: c.id,
      title: c.title,
      topic: TOPIC_LABEL[c.topic] ?? c.topic,
      minutes: c.minutes,
      summary: c.summary,
      body: c.body ?? [],
      points: c.points ?? 10,
    }));
}

export const LESSONS: Lesson[] = lessonsFrom(LIBRARY);

export const TIPS: string[] = [
  "Drink a glass of water before your morning tea.",
  "A short walk after a meal can help you feel lighter.",
  "Go to bed at the same time tonight as last night.",
  "Small steps every day beat big plans you don't keep.",
  "Put your phone in another room when you sleep.",
  "Take the stairs today, even for one floor.",
  "Missed a day? Just start again today. No pressure.",
];
