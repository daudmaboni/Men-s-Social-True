// DEVELOPMENT FIXTURES — sample community posts so the feed isn't empty while there is no server.
// Shown with a "Sample" label. Replaced by real posts when the community backend is connected.
// No sample reply pretends to be a doctor or verified expert.

import type { Post, Reply } from "./community";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const SAMPLE_POSTS: Post[] = [
  {
    id: "sample-1",
    topic: "confidence",
    title: "Nervous with a new partner — how do you calm down?",
    body: "Things were fine before, but with someone new I overthink everything and it affects me. Anyone been through this?",
    author: { name: "Anonymous member", anonymous: true },
    createdAt: hoursAgo(3),
    fixture: true,
    baseReactions: { support: 12, same: 9, helpful: 2 },
  },
  {
    id: "sample-2",
    topic: "wellbeing",
    title: "Started walking every evening — energy is better",
    body: "Two weeks of 20-minute walks after dinner. Sleeping better and less tired at work. Small thing but it helps.",
    author: { name: "Baraka_DSM", anonymous: false },
    createdAt: hoursAgo(9),
    fixture: true,
    baseReactions: { support: 18, helpful: 7 },
  },
  {
    id: "sample-3",
    topic: "erection",
    title: "Is it worth seeing a doctor at 35?",
    body: "For about two months it's been harder to stay hard. I feel too young for this. Should I just wait?",
    author: { name: "Anonymous member", anonymous: true },
    createdAt: hoursAgo(20),
    wantsExpert: true,
    fixture: true,
    baseReactions: { support: 15, same: 6 },
  },
  {
    id: "sample-4",
    topic: "intimacy",
    title: "How did you start talking to your wife about this?",
    body: "I don't know how to bring it up without it becoming a fight.",
    author: { name: "Anonymous member", anonymous: true },
    createdAt: hoursAgo(30),
    fixture: true,
    baseReactions: { support: 8, same: 11 },
  },
  {
    id: "sample-5",
    topic: "ejaculation",
    title: "Tried the stop-start technique for 3 weeks",
    body: "Felt awkward at first but it's helping me notice when I'm close. Sharing in case it helps someone.",
    author: { name: "Juma_77", anonymous: false },
    createdAt: hoursAgo(52),
    fixture: true,
    baseReactions: { helpful: 21, support: 9 },
  },
];

export const SAMPLE_REPLIES: Reply[] = [
  {
    id: "sample-r1",
    postId: "sample-1",
    body: "Same here. Slowing down and not rushing helped me a lot. Also told her I was nervous — she was very understanding.",
    author: { name: "Anonymous member", anonymous: true },
    createdAt: hoursAgo(2),
    fixture: true,
    baseReactions: { helpful: 5 },
  },
  {
    id: "sample-r2",
    postId: "sample-1",
    body: "The breathing video in Discover is good before a date. Sounds simple but it works for me.",
    author: { name: "Mzee_Kijana", anonymous: false },
    createdAt: hoursAgo(1),
    fixture: true,
    baseReactions: { helpful: 3, support: 2 },
  },
  {
    id: "sample-r3",
    postId: "sample-3",
    body: "Go. I waited a year and when I finally went the doctor found my blood pressure was high. Better to know early.",
    author: { name: "Anonymous member", anonymous: true },
    createdAt: hoursAgo(15),
    fixture: true,
    baseReactions: { helpful: 14, support: 6 },
  },
  {
    id: "sample-r4",
    postId: "sample-4",
    body: "I chose a calm evening and started with 'I've been stressed lately'. It went much better than I feared.",
    author: { name: "Anonymous member", anonymous: true },
    createdAt: hoursAgo(26),
    fixture: true,
    baseReactions: { helpful: 6 },
  },
];
