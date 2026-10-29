// Step 100: the areas a man can choose in the assessment, with a short plain explanation and where to read more.
// These are areas to look at together — the app never tells him he HAS one of them.
// References are public health sources (NHS, WHO, AHA), listed so a clinician can review every rule.

import type { ConcernId, GoalId, Txt } from "./types";

export interface ConcernDef {
  id: ConcernId;
  name: Txt;
  /** One or two plain sentences: what this is, and what's worth knowing first. */
  about: Txt;
  /** Read more (trusted public sources). */
  refs: { label: string; url: string }[];
}

export const CONCERNS: ConcernDef[] = [
  {
    id: "erection",
    name: { sw: "Uume kusimama au kudumu", en: "Getting or keeping an erection" },
    about: {
      sw: "Kusimama kunategemea damu, mishipa, homoni, usingizi na akili. Mara nyingi ni ishara ya mwili mzima, kwa hiyo presha, sukari na moyo ni vya kuangaliwa pia.",
      en: "Erections depend on blood flow, nerves, hormones, sleep and your head. It's often a sign about the whole body, so blood pressure, sugar and heart are worth checking too.",
    },
    refs: [{ label: "NHS: Erection problems", url: "https://www.nhs.uk/conditions/erection-problems-erectile-dysfunction/" }],
  },
  {
    id: "early",
    name: { sw: "Kuwahi kumwaga", en: "Finishing too early" },
    about: {
      sw: "Ni jambo la kawaida sana, na mara nyingi linaboreka kwa mazoezi ya misuli ya nyonga na mbinu za kujizuia.",
      en: "Very common, and it often gets better with pelvic floor exercises and control techniques.",
    },
    refs: [{ label: "NHS: Ejaculation problems", url: "https://www.nhs.uk/conditions/ejaculation-problems/" }],
  },
  {
    id: "hernia",
    name: { sw: "Ngiri (hernia)", en: "Hernia" },
    about: {
      sw: "Ngiri ni uvimbe unaotokea pale misuli ya tumbo au kinena inapolegea. Daktari ndiye anayeweza kuthibitisha. Mpaka hapo, epuka kubeba vitu vizito na kujikamua.",
      en: "A hernia is a bulge where the muscle wall of the belly or groin is weak. Only a doctor can confirm it. Until then, avoid heavy lifting and straining.",
    },
    refs: [{ label: "NHS: Hernia", url: "https://www.nhs.uk/conditions/hernia/" }],
  },
  {
    id: "digestion",
    name: { sw: "Tumbo: gesi, kuvimbiwa, vidonda", en: "Stomach: gas, bloating, ulcers" },
    about: {
      sw: "Gesi, kuvimbiwa na kiungulia mara nyingi vinahusiana na ulaji na muda wa kula. Vidonda vya tumbo vinathibitishwa kwa kipimo, si kwa dalili peke yake.",
      en: "Gas, bloating and heartburn are often about what and when you eat. A stomach ulcer is confirmed with a test, not by symptoms alone.",
    },
    refs: [
      { label: "NHS: Indigestion", url: "https://www.nhs.uk/conditions/indigestion/" },
      { label: "NHS: Stomach ulcer", url: "https://www.nhs.uk/conditions/stomach-ulcer/" },
    ],
  },
  {
    id: "bp",
    name: { sw: "Presha (shinikizo la damu)", en: "High blood pressure" },
    about: {
      sw: "Presha mara nyingi haina dalili. Njia pekee ya kujua ni kupima. Inaathiri pia mishipa inayopeleka damu kwenye uume.",
      en: "High blood pressure usually has no signs. The only way to know is to measure it. It also affects the blood vessels that feed an erection.",
    },
    refs: [
      { label: "WHO: Hypertension", url: "https://www.who.int/news-room/fact-sheets/detail/hypertension" },
      { label: "AHA: High blood pressure", url: "https://www.heart.org/en/health-topics/high-blood-pressure" },
    ],
  },
  {
    id: "sugar",
    name: { sw: "Kisukari au sukari ya damu", en: "Diabetes or blood sugar" },
    about: {
      sw: "Kisukari kinajulikana kwa kipimo cha damu. Kiu kali, kukojoa mara kwa mara na kupungua uzito bila sababu ni sababu za kupima.",
      en: "Diabetes is found with a blood test. Strong thirst, peeing a lot and losing weight without trying are reasons to get tested.",
    },
    refs: [
      { label: "WHO: Diabetes", url: "https://www.who.int/news-room/fact-sheets/detail/diabetes" },
      { label: "NHS: Type 2 diabetes symptoms", url: "https://www.nhs.uk/conditions/type-2-diabetes/symptoms/" },
    ],
  },
  {
    id: "mind",
    name: { sw: "Stress, hali ya moyo na usingizi", en: "Stress, mood and sleep" },
    about: {
      sw: "Stress, huzuni na usingizi mbaya vinaathiri nguvu na hamu. Kuongea na mtu na kupanga usingizi vinasaidia sana.",
      en: "Stress, low mood and poor sleep drain energy and desire. Talking to someone and sorting out sleep help a lot.",
    },
    refs: [{ label: "WHO: Depression", url: "https://www.who.int/news-room/fact-sheets/detail/depression" }],
  },
  {
    id: "weight",
    name: { sw: "Uzito na kutofanya mazoezi", en: "Weight and not moving enough" },
    about: {
      sw: "Kutembea na kula vizuri kila siku kunasaidia uzito, presha, sukari na nguvu kitandani. Hatua ndogo zinatosha kuanza.",
      en: "Walking and eating well every day help weight, blood pressure, sugar and bedroom strength. Small steps are enough to start.",
    },
    refs: [
      { label: "WHO: Physical activity", url: "https://www.who.int/news-room/fact-sheets/detail/physical-activity" },
      { label: "WHO: Obesity and overweight", url: "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight" },
    ],
  },
  {
    id: "back",
    name: { sw: "Mgongo, scoliosis au kutembea kwa shida", en: "Back problems, scoliosis or moving with difficulty" },
    about: {
      sw: "Mgongo unapenda mwendo mwepesi kuliko kulala tu. Mazoezi mazito yasubiri mpaka mtaalamu akuambie ni salama.",
      en: "A sore back usually does better with gentle movement than rest. Heavy exercise should wait until a professional says it's safe.",
    },
    refs: [{ label: "NHS: Back pain", url: "https://www.nhs.uk/conditions/back-pain/" }],
  },
];

export const concernById = (id: string) => CONCERNS.find((c) => c.id === id);

/**
 * Which areas come first when he chose several. Areas where a missed warning sign can be serious come
 * before the ones that are mostly about habits. This order decides the plan, not how much each matters to him.
 */
export const CONCERN_PRIORITY: ConcernId[] = ["hernia", "bp", "sugar", "back", "digestion", "mind", "erection", "early", "weight"];

export const GOALS: { id: GoalId; label: Txt }[] = [
  { id: "bedroom", label: { sw: "Kuwa imara na kudumu kitandani", en: "Stronger and lasting longer in bed" } },
  { id: "energy", label: { sw: "Nguvu zaidi mchana", en: "More energy in the day" } },
  { id: "sleep", label: { sw: "Kulala vizuri", en: "Better sleep" } },
  { id: "fit", label: { sw: "Kupunguza uzito au kuwa fiti", en: "Lose weight or get fit" } },
  { id: "calm", label: { sw: "Stress kidogo", en: "Less stress" } },
  { id: "stomach", label: { sw: "Tumbo lenye amani", en: "A settled stomach" } },
  { id: "condition", label: { sw: "Kutunza hali niliyonayo", en: "Look after a condition I have" } },
];

/** Shown beside "Has a doctor confirmed it?" so he knows what each answer means. */
export const CERTAINTY_EXPLAINED: { id: "diagnosed" | "suspected" | "signs"; label: Txt; meaning: Txt }[] = [
  {
    id: "diagnosed",
    label: { sw: "Daktari amethibitisha", en: "A doctor confirmed it" },
    meaning: {
      sw: "Daktari au mtaalamu wa afya alikupima na kukwambia jina lake.",
      en: "A doctor or health worker examined or tested you and told you what it is.",
    },
  },
  {
    id: "suspected",
    label: { sw: "Nahisi ninalo", en: "I think I have it" },
    meaning: {
      sw: "Unahisi ndilo, lakini bado hujapimwa. Hilo ni la kuthibitisha, si uhakika.",
      en: "You think it's this, but no one has checked yet. It's something to confirm, not a fact.",
    },
  },
  {
    id: "signs",
    label: { sw: "Nina dalili tu", en: "I only have some signs" },
    meaning: {
      sw: "Unaona dalili fulani, hujui ni nini. Dalili moja inaweza kuwa na sababu nyingi.",
      en: "You notice something but don't know what it is. One sign can have many causes.",
    },
  },
];
