// Step 100: the approved actions a plan is built from. The engine only picks from this list; nothing is invented.
// Self-care habits and checks only: no medicine, supplement or herb is ever suggested here.
//
// activity: the same id as a Man-tab activity (lib/feed/catalog.ts). Ticking it here ticks it there too,
//           so there is one record and no double points. "tracker" ones (check-in, sleep, water) are filled
//           in on the Man tab, so here they open it.
// card:     a Discover card with the full steps (/social/c/<id>).

import type { ConcernId, GoalId, Restriction, Txt } from "./types";

export type TaskKind = "daily" | "weekly" | "once";

export interface TaskDef {
  id: string;
  title: Txt;
  /** One simple instruction. */
  how: Txt;
  /** Why it matters, in one sentence. */
  why: Txt;
  /** How often / how long. */
  often: Txt;
  kind: TaskKind;
  concerns: ConcernId[];
  goals: GoalId[];
  /** Base importance (higher first). */
  priority: number;
  activity?: "checkin" | "sleep" | "water" | "walk" | "breathe" | "screens-off";
  tracker?: boolean;
  card?: string;
  /** Left out of his plan when he has any of these. */
  avoid?: Restriction[];
  /** A safety line shown with the task when he has this restriction. */
  caution?: Partial<Record<Restriction, Txt>>;
  /** Shown to everyone with this task. */
  safety?: Txt;
}

const t = (sw: string, en: string): Txt => ({ sw, en });
const MEDS_MOVE = t(
  "Kwa kuwa unatumia dawa ya sukari, muulize mtoa huduma wako jinsi ya kufanya mazoezi salama, na ubebe kitu kitamu.",
  "Because you take sugar medicine, ask your health worker how to exercise safely, and carry something sweet.",
);

export const TASKS: TaskDef[] = [
  {
    id: "walk",
    activity: "walk",
    title: t("Tembea dakika 20", "Walk for 20 minutes"),
    how: t("Mwendo wowote unaokufaa. Nje kama unaweza.", "Any pace that's comfortable. Outside if you can."),
    why: t("Kutembea kunasukuma damu mwilini, kunashusha presha na sukari, na kunasaidia usingizi.", "Walking gets blood moving, helps blood pressure and sugar, and improves sleep."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["erection", "bp", "sugar", "weight", "mind", "back", "digestion"],
    goals: ["energy", "fit", "bedroom", "calm", "condition"],
    priority: 40,
    caution: { "meds-exercise": MEDS_MOVE },
  },
  {
    id: "kegel",
    card: "do-kegel",
    title: t("Kegel: dakika 5", "Kegel: 5 minutes"),
    how: t("Bana misuli ya kuzuia mkojo sekunde 5, achia sekunde 5. Rudia dakika 5.", "Squeeze the muscles that stop your pee for 5 seconds, relax for 5. Repeat for 5 minutes."),
    why: t("Misuli hii inashikilia damu kwenye uume na inakusaidia kujizuia.", "These muscles hold blood in the penis and help you control when you finish."),
    often: t("Mara mbili kwa siku", "Twice a day"),
    kind: "daily",
    concerns: ["erection", "early"],
    goals: ["bedroom"],
    priority: 45,
  },
  {
    id: "stop-start",
    card: "do-stop-start",
    title: t("Jaribu mbinu ya simama, anza tena", "Practise stop-start"),
    how: t("Ukihisi unakaribia kumwaga, simama kabisa, pumua mpaka hamu ishuke, kisha anza tena taratibu.", "When you feel close, stop completely, breathe until the urge drops, then start again slowly."),
    why: t("Unajifunza kuujua mpaka wako na kurudi nyuma kabla haujafika.", "You learn where your edge is and how to step back before you reach it."),
    often: t("Mara moja kwa wiki au zaidi", "Once a week or more"),
    kind: "weekly",
    concerns: ["early"],
    goals: [],
    priority: 35,
  },
  {
    id: "breathe",
    activity: "breathe",
    title: t("Pumua taratibu dakika 5", "5 minutes of slow breathing"),
    how: t("Vuta pumzi sekunde 4, toa sekunde 6. Rudia dakika 5.", "Breathe in for 4 seconds, out for 6. Repeat for 5 minutes."),
    why: t("Inashusha stress, na stress ndogo inasaidia kujizuia na kulala.", "It lowers stress, and less stress helps control and sleep."),
    often: t("Kila jioni", "Every evening"),
    kind: "daily",
    concerns: ["mind", "early", "bp"],
    goals: ["calm", "sleep"],
    priority: 30,
  },
  {
    id: "checkin",
    activity: "checkin",
    tracker: true,
    title: t("Andika unavyojisikia leo", "Note how you feel today"),
    how: t("Mguso mbili: nguvu na hali ya moyo.", "Two taps: energy and mood."),
    why: t("Baada ya siku chache utaona kinachokupa nguvu na kinachokuchosha.", "After a few days you'll see what lifts you and what drains you."),
    often: t("Kila asubuhi", "Every morning"),
    kind: "daily",
    concerns: ["mind", "erection", "early"],
    goals: ["energy", "calm"],
    priority: 25,
  },
  {
    id: "sleep-log",
    activity: "sleep",
    tracker: true,
    title: t("Andika usingizi wa jana", "Log last night's sleep"),
    how: t("Saa uliyolala, uliyoamka na ulivyolala.", "When you went to bed, woke up, and how well you slept."),
    why: t("Usingizi ndio unaojenga nguvu na hamu. Ukiuandika, unaona mabadiliko.", "Sleep is where energy and desire are rebuilt. Writing it down shows you what changes."),
    often: t("Kila asubuhi", "Every morning"),
    kind: "daily",
    concerns: ["mind"],
    goals: ["sleep", "energy"],
    priority: 25,
  },
  {
    id: "screens-off",
    activity: "screens-off",
    title: t("Weka simu chini dakika 30 kabla ya kulala", "Phone down 30 minutes before bed"),
    how: t("Weka simu mbali na kitanda, acha akili itulie.", "Put the phone away from the bed and let your mind slow down."),
    why: t("Mwanga wa simu unachelewesha usingizi.", "Screen light delays sleep."),
    often: t("Kila usiku", "Every night"),
    kind: "daily",
    concerns: ["mind"],
    goals: ["sleep", "calm"],
    priority: 20,
  },
  {
    id: "water",
    activity: "water",
    tracker: true,
    title: t("Fikia lengo lako la maji", "Reach your water goal"),
    how: t("Andika glasi au chupa unazokunywa mchana.", "Log the glasses and bottles you drink through the day."),
    why: t("Maji ya kutosha yanasaidia nguvu, choo na mzunguko wa damu.", "Enough water helps energy, digestion and circulation."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["digestion", "sugar"],
    goals: ["energy", "stomach"],
    priority: 20,
  },
  {
    id: "veg",
    title: t("Mboga au tunda kwenye milo miwili", "Vegetables or fruit with two meals"),
    how: t("Ongeza mboga za majani, tunda au maharage kwenye milo miwili leo.", "Add greens, a fruit or beans to two meals today."),
    why: t("Mboga na matunda yanalinda mishipa ya damu na yanasaidia tumbo.", "Vegetables and fruit protect blood vessels and help your gut."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["erection", "bp", "sugar", "weight", "digestion"],
    goals: ["bedroom", "fit", "stomach", "condition"],
    priority: 30,
  },
  {
    id: "less-salt",
    title: t("Punguza chumvi leo", "Go easy on salt today"),
    how: t("Usiongeze chumvi mezani, na punguza vyakula vya pakiti na vya kukaanga.", "Don't add salt at the table, and cut down on packet and fried foods."),
    why: t("Chumvi nyingi inapandisha presha.", "Too much salt pushes blood pressure up."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["bp"],
    goals: ["condition"],
    priority: 38,
  },
  {
    id: "swap-soda",
    title: t("Badili soda kwa maji", "Swap soda for water"),
    how: t("Leo, kila ukitaka soda au juisi ya sukari, kunywa maji badala yake.", "Today, each time you want a soda or sugary juice, have water instead."),
    why: t("Vinywaji vya sukari vinapandisha sukari ya damu haraka na kuongeza uzito.", "Sugary drinks spike blood sugar fast and add weight."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["sugar", "weight"],
    goals: ["fit", "condition"],
    priority: 38,
  },
  {
    id: "slow-meals",
    title: t("Kula taratibu, milo midogo", "Eat slowly, smaller meals"),
    how: t("Tafuna vizuri, kula kiasi, na maliza kula saa 3 kabla ya kulala.", "Chew well, eat smaller portions, and finish eating 3 hours before bed."),
    why: t("Kula haraka na kula usiku sana kunaleta gesi, kujaa na kiungulia.", "Eating fast and eating late cause gas, bloating and heartburn."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["digestion"],
    goals: ["stomach"],
    priority: 40,
  },
  {
    id: "fibre",
    title: t("Nyuzinyuzi na maji kwa choo", "Fibre and water for your bowels"),
    how: t("Kula ugali wa dona, maharage, mboga au matunda, na unywe maji ya kutosha.", "Eat ugali wa dona, beans, greens or fruit, and drink enough water."),
    why: t("Nyuzinyuzi na maji vinalainisha choo.", "Fibre and water soften stools."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["digestion"],
    goals: ["stomach"],
    priority: 32,
  },
  {
    id: "lift-safe",
    title: t("Usibebe vizito, usijikamue", "No heavy lifting, no straining"),
    how: t("Ukibeba kitu, piga magoti na kibebe karibu na mwili. Usijikamue chooni.", "When you lift, bend your knees and hold it close. Don't strain on the toilet."),
    why: t("Kujikamua kunaongeza shinikizo tumboni na mgongoni.", "Straining raises pressure on your belly and back."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["hernia", "back"],
    goals: [],
    priority: 50,
  },
  {
    id: "gentle-move",
    title: t("Nyoosha mwili taratibu dakika 10", "10 minutes of gentle movement"),
    how: t("Tembea ndani au nje, zungusha mabega na nyonga taratibu. Simama ukisikia maumivu makali.", "Walk around, roll your shoulders and hips gently. Stop if anything hurts sharply."),
    why: t("Mgongo unapona vizuri ukiwa kwenye mwendo mwepesi kuliko ukilala tu.", "A sore back usually recovers better with gentle movement than with rest alone."),
    often: t("Kila siku", "Every day"),
    kind: "daily",
    concerns: ["back"],
    goals: [],
    priority: 42,
  },
  {
    id: "squats",
    card: "do-squats",
    title: t("Squats 15", "15 squats"),
    how: t("Simama miguu kwa upana wa mabega, shuka kama unakaa kwenye kiti, kisha simama. Mara 15.", "Feet shoulder-width apart, lower as if sitting on a chair, then stand. 15 times."),
    why: t("Miguu na nyonga imara zinasukuma damu vizuri.", "Strong legs and hips pump blood well."),
    often: t("Siku 3 kwa wiki", "3 days a week"),
    kind: "weekly",
    concerns: ["weight", "erection"],
    goals: ["fit", "bedroom"],
    priority: 22,
    avoid: ["no-strain", "gentle"],
    caution: { "meds-exercise": MEDS_MOVE },
  },
  {
    id: "talk",
    title: t("Ongea na mtu unayemwamini", "Talk to someone you trust"),
    how: t("Chukua dakika 10 uongee na rafiki, ndugu au mkeo kuhusu unavyojisikia.", "Take 10 minutes to talk to a friend, a relative or your wife about how you feel."),
    why: t("Mzigo ukiusema unapungua uzito.", "A weight you talk about gets lighter."),
    often: t("Mara moja kwa wiki", "Once a week"),
    kind: "weekly",
    concerns: ["mind"],
    goals: ["calm"],
    priority: 36,
  },
  {
    id: "bp-check",
    title: t("Pima presha", "Measure your blood pressure"),
    how: t("Pima famasi au kliniki, na uandike namba zote mbili.", "Have it measured at a pharmacy or clinic, and write down both numbers."),
    why: t("Presha mara nyingi haina dalili. Namba ndiyo inayokuambia.", "High blood pressure usually has no signs. The number tells you."),
    often: t("Mara moja sasa", "Once, now"),
    kind: "once",
    concerns: ["bp", "erection", "weight"],
    goals: ["condition"],
    priority: 48,
  },
];

export const taskById = (id: string) => TASKS.find((x) => x.id === id);
