// Step 86: starter hooks on some built-in cards, so Discover has them from day one. Staff can change any of
// these in the Content editor (Hooks), or add their own in the Card maker.

import type { ActionSpec } from "./types";

type Hooks = Pick<ActionSpec, "ask" | "series" | "challengeDays">;

const LAST = { id: "last-longer-in-5-nights", name: "Last longer in 5 nights", nameSw: "Dumu zaidi ndani ya usiku 5" };

export const BUILT_IN_HOOKS: Record<string, Hooks> = {
  // A series: one way to last longer each night, each one builds on the one before
  "do-deep-breathing": {
    series: { ...LAST, part: 1, tease: "Tomorrow: the stop-start trick.", teaseSw: "Kesho: mbinu ya kusimama na kuanza tena." },
  },
  "do-stop-start": {
    series: { ...LAST, part: 2, tease: "Tomorrow: the 15-second squeeze.", teaseSw: "Kesho: mbinu ya kubana kwa sekunde 15." },
  },
  "do-squeeze": {
    series: { ...LAST, part: 3, tease: "Tomorrow: a trick for your mind.", teaseSw: "Kesho: mbinu ya kucheza na akili yako." },
  },
  "do-count-backwards": {
    series: { ...LAST, part: 4, tease: "Tomorrow, the last part: positions that help.", teaseSw: "Kesho, sehemu ya mwisho: mikao inayosaidia." },
  },
  "do-positions-last": { series: { ...LAST, part: 5 } },

  // Try it for a few days
  "do-kegel": {
    challengeDays: 7,
    ask: {
      kind: "question",
      q: "The muscle that stops your pee midstream: what does it do in bed?",
      qSw: "Ule msuli unaoutumia kukatisha mkojo, una kazi gani kitandani?",
      a: "It's your pelvic floor. It squeezes to keep you hard and helps hold back the finish. Like any muscle, it gets stronger when you train it.",
      aSw: "Ni msuli wa nyonga (pelvic floor). Ndio unaoshikilia damu ili ubaki umedinda, na unakusaidia usiwahi kumwaga. Kama msuli mwingine wowote, ukiufanyisha mazoezi unaimarika.",
    },
  },
  "do-squats": { challengeDays: 7 },
  "do-breath-reset": { challengeDays: 5 },
  "do-water-by-weight": {
    challengeDays: 7,
    ask: {
      kind: "truefalse",
      q: "Water has nothing to do with how hard you get.",
      qSw: "Maji hayana uhusiano wowote na uimara wa mashine.",
      truth: false,
      a: "Blood is mostly water. When you're dry, blood is thicker and flows slower, and you feel it in bed.",
      aSw: "Damu kwa sehemu kubwa ni maji. Ukikosa maji, damu inakuwa nzito na inazunguka kwa uvivu, na matokeo yake unayaona kitandani.",
    },
  },
  "do-sleep": {
    challengeDays: 7,
    ask: {
      kind: "truefalse",
      q: "A strong man only needs 5 hours of sleep.",
      qSw: "Mwanaume wa nguvu anahitaji masaa 5 tu ya kulala.",
      truth: false,
      a: "Your body makes most of its testosterone while you sleep. Short nights mean lower drive and weaker mornings.",
      aSw: "Mwili hutengeneza sehemu kubwa ya testosterone ukiwa umelala. Ukilala kidogo, hamu inapungua na asubuhi unaamka dhaifu.",
    },
  },
  "do-beetroot-drink": {
    ask: {
      kind: "truefalse",
      q: "Beetroot can help blood flow.",
      qSw: "Beetroot inaweza kusaidia mzunguko wa damu.",
      truth: true,
      a: "Beetroot has nitrates, which the body turns into something that relaxes blood vessels. It's food, not magic: give it a couple of weeks.",
      aSw: "Beetroot ina nitrate, ambayo mwili unaigeuza kuwa kitu kinacholegeza mishipa ya damu. Ni chakula, sio miujiza: ipe kama wiki mbili.",
    },
  },
};
