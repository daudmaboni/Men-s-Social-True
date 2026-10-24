// Step 91: the signs that mean "see a doctor today" (or "talk to someone now"), checked by fixed rules
// before any AI, in English and Kiswahili, with common spellings and slang. The AI never decides these.
//
//  crisis  thoughts of suicide or self-harm → Kito answers with care and help to reach people now, no AI
//  urgent  body signs that need a doctor today → "see a doctor today" goes first, whatever the guides say:
//          chest pain or breathing trouble, fainting, blood in urine/semen/stool, an erection that won't go
//          down for hours, an injured or suddenly bent/swollen penis, sudden testicle pain or swelling,
//          not being able to pass urine.
// Kept as plain lists so a clinician can read and extend them. Tested phrase by phrase (safety.test.ts).

export type Flag = "crisis" | "urgent" | null;

/** Lower case, no accents, straight apostrophes, single spaces, letters not repeated more than twice. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/([a-z])\1{2,}/g, "$1$1")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that stand for the same body part or thing (English, Kiswahili, slang)
const PENIS = "(?:penis|dick|cock|manhood|uume|mkonga|mboo|dushe|mashine|machine|kitu changu)";
const BALLS = "(?:testic\\w*|testes|balls?|nuts|scrot\\w*|korodani|mapumbu|pumbu|kende)";
const URINE = "(?:urine|pee|piss|urinat\\w*|mkojo|kukojoa|nakojoa|nikikojoa)";
const SEMEN = "(?:semen|sperm|cum|ejaculat\\w*|shahawa|manii|mbegu|nikimwaga|kumwaga)";
const STOOL = "(?:stool|poo|poop|feces|faeces|kinyesi|haja kubwa)";
const NEAR = ".{0,40}";

const CRISIS_LIST = [
  "suicid\\w*",
  "kill(?:ing)? my ?self",
  "end(?:ing)? (?:my|it) (?:life|all)",
  "want(?:ed)? to die",
  "wish i (?:was|were) dead",
  "better off dead",
  "no reason to (?:live|go on)",
  "hang(?:ing)? my ?self",
  "self ?harm\\w*",
  "cut(?:ting)? my ?self",
  "overdose",
  "kujiua",
  "nijiue",
  "nitajiua",
  "najiua",
  "nataka kufa",
  "bora nife",
  "nife tu",
  "kujinyonga",
  "nijinyonge",
  "kujidhuru",
  "nijidhuru",
  "sitaki kuishi",
  "sina sababu ya kuishi",
  "maisha hayana (?:maana|thamani)",
];

const URGENT_LIST = [
  // Chest, breathing, fainting
  "chest (?:pain|pian|hurts?|hurting|tight\\w*|pressure|is paining)",
  "pain (?:in|on) (?:my |the )?chest",
  "heart (?:attack|pain|is paining)",
  "(?:can'?t|cannot|could ?n'?t|hard to|struggl\\w* to) breath\\w*",
  "short(?:ness)? of breath",
  "(?:fainted|fainting|passed out|blacked out|collapsed)",
  "(?:maumivu|kuuma) (?:ya |kwenye |katika )?kifua",
  "kifua (?:kinauma|kinaniuma|kinabana|kimebana)",
  "moyo (?:unauma|unaniuma|unadunda sana)",
  "(?:siwezi|nashindwa|kushindwa|nilishindwa) kupumua",
  "pumzi (?:inakata|imekata|inabana|haitoshi)",
  "(?:nilizimia|nimezimia|kuzimia|nikazimia)",
  // Blood where it shouldn't be
  // (not "blood type", "blood flow" or "makundi ya damu": the blood has to be IN it)
  `(?:blood|bleeding) (?:in|on|with|from|coming out with|comes out with|when i) (?:my |the )?(?:${URINE}|${SEMEN}|${STOOL})`,
  `bloody (?:${URINE}|${SEMEN}|${STOOL})`,
  `(?:${URINE}|${SEMEN}|${STOOL}) (?:(?:has|have|had|with|contains?|is|are|was|were|looks?|looked|came out|comes out|mixed|got|some|full of|like) )+(?:blood|bloody)`,
  "(?:peeing|pissing|passing|cumming|ejaculating|urinating) blood",
  "black (?:stool|poo|poop)",
  `damu (?:kwenye|katika|ndani ya|inatoka na|imechanganyika na) (?:${URINE}|${SEMEN}|${STOOL})`,
  `(?:${URINE}|${SEMEN}|${STOOL}) (?:una|ina|yana|zina|kuna|wenye|yenye|zenye|umechanganyika na|imechanganyika na|na) damu`,
  "(?:nakojoa|nimekojoa|nikikojoa|natoa|nimetoa|namwaga|nimemwaga|najisaidia) damu",
  // An erection that won't go down (priapism)
  // (not "how to stay hard for 2 hours": it has to be happening now)
  "(?:erection|hard ?on|boner)\\w*.{0,30}(?:won'?t|will not|doesn'?t|does not|isn'?t|is not) (?:go(?:ing)? down|go away|going away|soft\\w*)",
  "(?:it|penis|dick|i'?m|i am) (?:still )?(?:won'?t|will not|doesn'?t|does not) (?:go down|get soft|soften)",
  "(?:been|still|stayed|stuck|remained) (?:hard|erect|stiff)\\w*.{0,25}(?:for|since|over|more than) (?:\\d+|two|three|four|five|six|several|many) (?:hours?|hrs?)",
  "erection (?:has|have|had) (?:lasted|been there|stayed) (?:for )?(?:\\d+|two|three|four|five|six|several|many) (?:hours?|hrs?)",
  "still (?:hard|erect) after (?:hours|\\d+ hours?|sex)",
  "(?:umesimama|imesimama|kusimama|limesimama|mashine imesimama).{0,30}(?:masaa|saa (?:\\d+|mbili|tatu|nne|tano|sita))",
  "(?:masaa|saa (?:\\d+|mbili|tatu|nne|tano|sita)).{0,30}(?:umesimama|imesimama|bila kulala|bila kushuka)",
  `${PENIS}?.{0,20}(?:haulali|hailali|haishuki|haushuki|halishuki|hautaki kulala|haitaki kulala)`,
  // An injured penis
  `${PENIS}${NEAR}(?:broke|broken|snapp?ed|crack\\w*|popp?ed|bent suddenly|suddenly bent|swoll\\w*|bruis\\w*|black|purple|bleeding)`,
  "(?:heard|felt) (?:a |something )?(?:pop|crack|snap)\\w*.{0,40}(?:sex|penis|dick|during|bed)",
  `${PENIS}${NEAR}(?:umevunjika|imevunjika|limevunjika|umepinda ghafla|imepinda ghafla|umevimba|imevimba|limevimba|kuvimba|umekuwa mweusi|inatoa damu)`,
  "(?:nilisikia|nimesikia) (?:kitu )?(?:kimevunjika|kuvunjika|mlio)",
  // Testicles: sudden pain or swelling
  `${BALLS}${NEAR}(?:pain\\w*|pian|hurt\\w*|swell\\w*|swoll\\w*|throbb\\w*)`,
  `(?:painful|pain in|hurting|swollen|swelling (?:in|of))${NEAR}${BALLS}`,
  `${BALLS}${NEAR}(?:maumivu|kuuma|inauma|zinauma|inaniuma|zinaniuma|kuvimba|imevimba|zimevimba|limevimba)`,
  `(?:maumivu|kuuma|kuvimba|uvimbe)${NEAR}${BALLS}`,
  // Can't pass urine
  "(?:can'?t|cannot|unable to|couldn'?t) (?:pee|urinate|pass urine|piss)",
  "(?:siwezi|nashindwa|sijaweza|nimeshindwa) kukojoa",
  "mkojo (?:umeziba|hautoki|umekataa|umegoma|umekwama)",
];

const CRISIS = new RegExp(`\\b(?:${CRISIS_LIST.join("|")})\\b`);
const URGENT = new RegExp(`(?:${URGENT_LIST.join("|")})`);

/** What the question needs before anything else: crisis care, a doctor today, or nothing special. */
export function safetyFlag(question: string): Flag {
  const q = normalize(question);
  if (CRISIS.test(q)) return "crisis";
  if (URGENT.test(q)) return "urgent";
  return null;
}
