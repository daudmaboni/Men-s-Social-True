// Starting outline for "MTIE Wazimu Mkeo" (Step 48).
// The Studio (Courses → "Start from the MTIE Wazimu Mkeo outline") saves this as the first draft.
// After that, the Studio is the only place it's edited; this file is never read by the men's app.
//
// Owned by Kayani Herbs, adapted from the course by Mangi Masawe.
// Hidden lessons (hidden: true) stay in the Studio for a decision but are never shown to men.

import type { Course, CourseLesson } from "./types";

const SIZE_CAUTION =
  "Stop at once if you feel pain, see bruising or small red spots, or lose feeling. Exercises like this are not proven to make the penis bigger, and too much force can injure it. If you have a curve, pain or a problem with erections, see a doctor first.";
const SIZE_CAUTION_SW =
  "Acha mara moja ukisikia maumivu, ukiona michubuko au vidoti vyekundu, au ukipoteza hisia. Mazoezi ya aina hii hayajathibitishwa kuongeza ukubwa wa uume, na nguvu nyingi zinaweza kuuumiza. Kama una mpindo, maumivu au tatizo la kusimama, muone daktari kwanza.";

const SIZE_NOTE =
  "Hidden on purpose: no evidence it increases size, and real risk of injury (bruising, broken vessels, nerve damage). Only unhide after a health professional has reviewed it; the caution box is ready.";

const L = (code: string, title: string, titleSw: string, kind: CourseLesson["kind"], seconds: number | undefined, extra: Partial<CourseLesson> = {}): CourseLesson => ({
  id: `wz-${code.replace(/\./g, "-")}`,
  code,
  title,
  titleSw,
  kind,
  ...(seconds ? { seconds } : {}),
  points: 10,
  ...extra,
});

export const WAZIMU_OUTLINE: Course = {
  version: 1,
  id: "wazimu",
  title: "MTIE Wazimu Mkeo",
  titleSw: "MTIE Wazimu Mkeo",
  summary: "A step-by-step audio course for husbands: goals, a confident mindset, preparing her emotionally, touch and intimacy, food and stamina, and Kegel training.",
  summarySw: "Kozi ya sauti hatua kwa hatua kwa waume: malengo, akili ya kujiamini, kumwandaa mkeo kisaikolojia, mguso na mahaba, lishe na stamina, na mazoezi ya Kegel.",
  credit: "© Kayani Herbs · Adapted from the course by Mangi Masawe",
  creditSw: "© Kayani Herbs · Imeandaliwa kutoka kozi ya Mangi Masawe",
  passPercent: 85,
  modules: [
    {
      id: "m1",
      title: "Your goals",
      titleSw: "Malengo yako",
      lessons: [
        L("0.0", "Utangulizi: MTIE Wazimu Mkeo", "Utangulizi: MTIE Wazimu Mkeo", "audio", 242),
        L("1.0", "Setting your goals", "Malengo", "audio", 265),
        L("1.1", "Answer these questions", "Jibu maswali haya", "reading", undefined, {
          bodySw: [
            "Jibu maswali haya kwa kuandika kwenye notebook yako. Chukua muda, jibu kwa ukweli.",
            "1. Unatamani kuona nini kinatokea kwenye mahusiano yako?",
            "2. Unatamani mke wako akuchukuliaje?",
            "3. Unatamani performance yako iweje kitandani?",
            "4. Mambo gani unatakiwa kuzingatia au kufanya ili utimize maono yako haya?",
            "Suluhisho ni MTIE Wazimu.",
          ],
          body: [
            "Answer these questions in your notebook. Take your time and be honest.",
            "1. What do you want to see happen in your relationship?",
            "2. How do you want your wife to see you?",
            "3. How do you want your performance in bed to be?",
            "4. What do you need to keep in mind or do to reach these goals?",
            "The answer is MTIE Wazimu.",
          ],
        }),
        L("1.2", "After you answer", "Baada ya kujibu", "audio", 23),
        L("1.3", "A real example of goals", "Mfano halisi wa malengo", "audio", 332),
      ],
    },
    {
      id: "m2",
      title: "The Alpha Man mindset",
      titleSw: "Mindset ya Alpha Man",
      lessons: [
        L("2.0", "The Alpha Man mindset", "Mindset ya Alpha Man", "audio", 543),
        L("2.1", "Affirmations", "Affirmation", "audio", 629),
        L("2.2", "Real affirmation examples", "Mifano halisi ya affirmation", "audio", 143),
        L("2.2.1", "Rules for writing your affirmations", "Kanuni na mifano ya affirmation", "reading", undefined, {
          bodySw: [
            "## Kanuni za kuandika affirmation zako",
            "1. Andika affirmation ambayo ni realistic na unaweza kuitimiza.",
            "2. Andika kauli yenye nguvu kadri inavyowezekana. Mfano: \"Najiamini kikamilifu\" ni bora zaidi kuliko \"Ninajiamini\".",
            "3. Andika affirmation kwa maneno machache ili iwe rahisi kukumbuka.",
            "4. Akili yako itapokea vizuri kama utatumia kauli chanya. \"Ninajisikia mchangamfu sana nikiwa na mpenzi wangu\" ni bora kuliko \"Sijisikii mpweke nikiwa na mpenzi wangu\".",
            "5. Unapotaka kuacha tabia, tumia kauli \"Naacha kujisikia…\". Mfano: \"Naacha kujisikia naogopeshwa na uwepo wa wanaume wengi karibu na mke wangu.\" Itakupunguzia wivu usio na msingi na hofu ya kuibiwa penzi.",
            "## Mifano halisi ya affirmation",
            "Ninajiamini sana.",
            "Navutiwa na mpenzi wangu.",
            "Maisha yangu ni ya furaha.",
            "Najua kumridhisha mpenzi wangu kiasi cha kumfanya aning'ang'anie.",
            "Najua kumshangaza mpenzi wangu kwa ufundi kitandani na mahaba.",
            "I am so romantic.",
            "Mimi ni mwanaume wa ndoto wa mpenzi wangu.",
            "Kumbuka: unaruhusiwa kuandika affirmation kwa lugha yoyote itakayokusisimua na kukupa hari na motisha.",
          ],
          body: [
            "## Rules for writing your affirmations",
            "1. Write an affirmation that is realistic and that you can live up to.",
            "2. Make it as strong as you can. \"I am fully confident\" is better than \"I am confident\".",
            "3. Keep it short so it's easy to remember.",
            "4. Your mind accepts positive words better. \"I feel full of life with my partner\" is better than \"I don't feel lonely with my partner\".",
            "5. To drop a habit, say \"I stop feeling…\". For example: \"I stop feeling threatened when other men are near my wife.\" It eases pointless jealousy and the fear of losing her.",
            "## Real examples",
            "I am very confident.",
            "I am attracted to my partner.",
            "My life is happy.",
            "I know how to satisfy my partner so she wants to stay close.",
            "I know how to surprise my partner with skill and romance in bed.",
            "I am so romantic.",
            "I am my partner's dream man.",
            "Remember: write your affirmations in whatever language excites and motivates you.",
          ],
        }),
      ],
    },
    {
      id: "m3",
      title: "Prepare her emotionally",
      titleSw: "Muandae mkeo kisaikolojia",
      lessons: [
        L("3.0", "Prepare her emotionally", "Muandae mkeo kisaikolojia", "audio", 98),
        L("3.1", "Know your boundaries together", "Fahamu mipaka na mkeo katika tendo la ndoa", "audio", 231),
        L("3.2", "7 mistakes men make in bed", "Makosa 7 ya wanaume kitandani", "audio", 545),
        L("3.3", "17 sensitive areas", "Maeneo 17 yenye msisimko mkali", "audio", 162),
        L("3.3.1", "17 sensitive areas (notes)", "Maeneo 17 (maelezo)", "reading", undefined, {
          hidden: true,
          staffNote:
            "Paste the corrected text from the PDF here, then unhide. Fix before publishing: remove the made-up \"Dr. Witwatersrand\" (it's a university), remove the claim that the middle toe is wired to the genitals, and add the missing point 6.",
        }),
        L("3.4", "Start preparing her early", "Muandae mwanamke kisaikolojia: anza mapema", "audio", 395),
      ],
    },
    {
      id: "m4",
      title: "8 things that drive her wild",
      titleSw: "Mambo 8 ya kutia wazimu kitandani",
      lessons: [
        L("4.0", "8 things that drive her wild", "Mambo 8 ya kutia wazimu kitandani", "audio", 541),
        L("4.1", "Gentle squeezing", "Minyaminya kimahaba", "audio", 240),
        L("4.2", "Where to squeeze and excite", "Maeneo ya kuminya na kumsisimua", "audio", 279),
        L("4.3", "The art of touch (with the penis)", "Sanaa ya mguso na mpapaso kwa mkonga", "audio", 441),
        L("4.4", "The art of touch and caress", "Sanaa ya mguso na mpapaso", "audio", 519),
        L("4.5", "Pleasing the clitoris", "Madoido kwenye kisimi", "audio", 272),
        L("4.6", "Enjoying the G-spot", "Furahia utamu wa G-spot", "audio", 543),
        L("4.7", "G-spot, clitoris and bold positions", "G-spot, kisimi na mikao wild", "audio", 293),
        L("4.8", "Sweet positions (part 1)", "Mikao mitamu (sehemu ya 1)", "audio", 458),
        L("4.8.1", "Sweet positions (part 2)", "Mikao mitamu (sehemu ya 2)", "audio", 490),
      ],
    },
    {
      id: "m5",
      title: "Food, supplements and exercise",
      titleSw: "Lishe, virutubisho na mazoezi",
      lessons: [
        L("5.0", "Food, supplements and exercise", "Hatua ya 4: lishe, virutubisho na mazoezi", "audio", 96),
        L("5.1", "Food and blood groups", "Vyakula pamoja na makundi ya damu", "audio", 444, {
          hidden: true,
          staffNote: "Hidden on purpose: research doesn't support eating by blood group. Keep hidden, or have a health professional check it first.",
        }),
        L("5.2", "Benefits of supplements", "Faida za supplements", "audio", 579, {
          caution: "Talk to a doctor or pharmacist before taking supplements, especially if you take medicine for blood pressure, the heart or diabetes. Only buy products registered with TMDA.",
          cautionSw: "Ongea na daktari au mfamasia kabla ya kutumia virutubisho, hasa kama unatumia dawa za presha, moyo au kisukari. Nunua bidhaa zilizosajiliwa na TMDA tu.",
        }),
        L("5.3", "Exercises for stamina", "Mazoezi ya kuimarisha stamina", "audio", 334),
        L("5.4", "A 30-day eating plan", "Mpangilio wa chakula wa siku 30", "reading", undefined, {
          bodySw: [
            "## Sahani ya matunda (isikose)",
            "Ndizi 3 hadi 5, tikiti maji, parachichi na nusu karoti.",
            "## Chakula",
            "Ugali (wa dona au uwele) pamoja na mboga za kijani kama spinachi, na dagaa, chaza, mayai au pweza.",
            "Tumia asali vijiko 2 kabla ya mlo. Usiache siagi ya karanga na mbegu za maboga; unaweza kutafuna wakati wowote. Chokoleti kidogo inasaidia hamu ya tendo.",
            "## Ratiba ya siku",
            "Asubuhi: brown bread au viazi (si maandazi wala chapati kwa siku hizi 30), mayai ya kuku wa kienyeji, na sahani ya matunda ya kutosha.",
            "Mchana: sahani ya matunda, ugali wa dona au uwele, mboga za kijani, dagaa au mayai.",
            "Saa tisa (ukiweza): matunda.",
            "Jioni: kama mchana. Wahi kula kabla ya saa mbili usiku, angalau masaa 2 kabla ya kulala, ili mwili umeng'enye chakula vizuri.",
            "## Kumbuka",
            "Kunywa maji ya kutosha, na juisi yenye tangawizi.",
            "Fanya mazoezi, hasa kukimbia, kusaidia mzunguko mzuri wa damu.",
          ],
          body: [
            "## Fruit plate (every day)",
            "3 to 5 bananas, watermelon, avocado and half a carrot.",
            "## Meals",
            "Ugali (whole-grain dona or millet) with green vegetables such as spinach, plus dagaa, oysters, eggs or octopus.",
            "Take 2 teaspoons of honey before a meal. Keep peanut butter and pumpkin seeds close; snack on them any time. A little chocolate helps desire.",
            "## Daily plan",
            "Morning: brown bread or potatoes (no maandazi or chapati for these 30 days), free-range eggs, and a good fruit plate.",
            "Midday: fruit plate, ugali wa dona or millet, green vegetables, dagaa or eggs.",
            "3 pm (if you can): fruit.",
            "Evening: like midday. Eat before 8 pm, at least 2 hours before bed, so your body digests well.",
            "## Remember",
            "Drink enough water, and juice with ginger.",
            "Exercise, especially running, for good blood flow.",
          ],
        }),
      ],
    },
    {
      id: "m6",
      title: "Kegel and strength training",
      titleSw: "Mazoezi ya Kegel na mkonga",
      lessons: [
        L("6.0", "Kegel exercises (video)", "Video ya mazoezi ya Kegel", "video", 102),
        L("6.1", "The Kegel exercise", "Zoezi la Kegel", "audio", 158),
        L("6.2", "Your first Kegel workout", "Zoezi la kwanza la Kegel", "audio", 305),
        L("6.3", "Warm-up", "Mkonga warm up", "audio", 347, {
          caution: "Be gentle. Stop if anything hurts.",
          cautionSw: "Fanya taratibu. Acha kama kuna maumivu yoyote.",
        }),
        L("6.4", "How firm is an erection?", "Kiasi cha kusimama kwa mkonga", "audio", 191),
        L("6.5", "Erection levels", "Asilimia za mkonga kusimama", "reading", undefined, {
          bodySw: [
            "Viwango vinne vya kusimama, kutoka kwenye somo lililopita:",
            "1. Asilimia 0: haujasimama kabisa.",
            "2. Asilimia 25: umeanza kujaa.",
            "3. Asilimia 50: umesimama nusu.",
            "4. Asilimia 100: umesimama kikamilifu.",
          ],
          body: [
            "The four levels from the last lesson:",
            "1. Zero percent: not erect at all.",
            "2. 25 percent: starting to fill.",
            "3. 50 percent: half erect.",
            "4. A hundred percent: fully erect.",
          ],
        }),
        L("6.6", "JQ exercise", "Zoezi la JQ", "audio", 100, { hidden: true, staffNote: SIZE_NOTE, caution: SIZE_CAUTION, cautionSw: SIZE_CAUTION_SW }),
        L("6.6.1", "JQ exercise (part 2)", "Zoezi la JQ (sehemu ya 2)", "audio", 252, { hidden: true, staffNote: SIZE_NOTE, caution: SIZE_CAUTION, cautionSw: SIZE_CAUTION_SW }),
        L("6.7", "ST exercise", "Zoezi la ST", "audio", 242, { hidden: true, staffNote: SIZE_NOTE, caution: SIZE_CAUTION, cautionSw: SIZE_CAUTION_SW }),
        L("6.8", "Your training routine", "Utaratibu wa mazoezi", "audio", 122),
      ],
    },
    {
      id: "m7",
      title: "Bonus: dry orgasm",
      titleSw: "Ziada: dry orgasm",
      lessons: [
        L("7.1", "How to have a dry orgasm", "Jinsi ya kupata dry orgasm", "audio", 291, {
          caution: "If you often have no semen without trying to, or notice pain or blood in your semen, see a doctor.",
          cautionSw: "Kama mara nyingi hutoi shahawa bila kukusudia, au unaona maumivu au damu kwenye shahawa, muone daktari.",
        }),
        L("7.2", "Benefits of a dry orgasm", "Faida za dry orgasm", "audio", 511),
      ],
    },
  ],
};
