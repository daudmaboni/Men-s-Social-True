// The words men read first on each card, written the way a kaka talks, not the way a textbook does.
// t = title, h = the opening line, w = the "secret" (why it works). [English, Kiswahili].
// Anything not listed here keeps the wording in actions.ts / actions-instagram.ts.

type Bi = [string, string];
export const VOICE: Record<string, { t?: Bi; h?: Bi; w?: Bi }> = {
  "do-stop-start": {
    h: ["Feel it coming? Stop. Breathe. Go again. That's how men last.", "Unahisi unakaribia kumwaga? Simama kidogo, vuta pumzi, kisha endelea. Hiyo ndiyo siri ya wanaume wanaodumu."],
    w: ["Every time you stop at the edge, your body learns where the edge is. After a few nights you control it, not the other way round.", "Kila unaposimama ukikaribia kumwaga, mwili unajifunza kujizuia. Baada ya siku chache tu, wewe ndiye utakayeamua lini umalize, sio mwili."],
  },
  "ig-make-her-shake": { h: ["Do these and watch her body answer you.", "Fanya haya, utaona mwili wake unavyoitikia."] },
  "ig-watermelon-lemon": { h: ["Half a kilo of watermelon, three lemons, one week. Simple, and it works.", "Nusu kilo ya tikiti maji, malimau matatu, kwa wiki moja. Ni rahisi, na inafanya kazi kweli."] },
  "do-start-her-day": {
    h: ["Sex doesn't start in bed. It starts with the message you send her at 11 am.", "Mechi haianzii kitandani, kaka. Inaanzia kwenye ile SMS unayomtumia saa tano asubuhi."],
    w: ["A woman warms up slowly. If you've been sweet to her all day, by night she's already halfway there.", "Mwanamke huchelewa kupata moto. Ukimdekeza siku nzima, usiku ukifika anakuwa ameshapata hamu tayari."],
  },
  "do-garlic-shot": {
    h: ["Six cloves in the morning, six at night. Old trick, still the best.", "Punje sita asubuhi, sita usiku. Ni dawa ya zamani, lakini bado inaongoza."],
    w: ["A hard erection is just good blood flow. Garlic keeps the pipes open.", "Mashine kusimama imara ni damu kuzunguka vizuri tu. Kitunguu swaumu kinasafisha njia ya damu."],
  },
  "do-kegel": {
    h: ["The muscle nobody trains, and the one that decides how long you last.", "Msuli ambao wanaume wengi hawaujui, na ndio unaoamua utadumu muda gani."],
    w: ["This muscle squeezes the blood in and holds back the finish. Make it strong and you're the boss.", "Msuli huu ndio unaoshikilia damu kwenye uume na kukuzuia usimwage mapema. Ukiuimarisha, kitandani unakuwa bosi."],
  },
  "ig-second-round": { h: ["Round two is won in the five minutes after round one.", "Bao la pili linaamuliwa ndani ya dakika tano baada ya bao la kwanza."] },
  "do-g-spot": {
    h: ["Two fingers, five centimetres, a \"come here\" move. She'll remember it.", "Vidole viwili, sentimita tano ndani, mwendo wa kumwita mtu “njoo”. Hatakusahau."],
    w: ["That spot is full of nerves. Get it right and many women finish more than once.", "Pale kuna mishipa mingi ya hisia. Ukipagusa vizuri, wanawake wengi hufika kileleni zaidi ya mara moja."],
  },
  "ig-pumpkin-chia-seeds": {
    h: ["A spoon of pumpkin seeds a day. Cheap, and your semen will thank you.", "Kijiko kimoja cha mbegu za maboga kila siku. Ni bei rahisi, na utaona tofauti kwenye mbegu zako."],
    w: ["They're loaded with zinc and magnesium, the stuff your body uses to make testosterone and semen.", "Zina zinki na magnesiamu kwa wingi, vitu ambavyo mwili unavihitaji kutengeneza testosterone na mbegu za kiume."],
  },
  "do-squeeze": {
    h: ["About to finish too early? Pull out, squeeze, count to 20. Back in the game.", "Unakaribia kumwaga mapema? Toa, bana, hesabu mpaka 20. Unarudi mchezoni."],
    w: ["The squeeze cuts the signal to finish. The urge drops and you start again fresh.", "Kubana kunazima ile hamu ya kumwaga. Inashuka, na unaanza upya ukiwa fresh."],
  },
  "ig-clove-ginger-honey-morning": { h: ["Cloves, ginger and honey before breakfast. Your body wakes up properly.", "Karafuu, tangawizi na asali kabla ya chai ya asubuhi. Mwili unaamka na nguvu."] },
  "do-watermelon-drink": {
    h: ["Watermelon is nature's blood-flow drink. Add ginger and pumpkin seeds and it's even better.", "Tikiti maji ni dawa ya asili ya kuzungusha damu. Ukiongeza tangawizi na mbegu za maboga, ndio kabisa."],
    w: ["Watermelon has citrulline. Your body turns it into nitric oxide, which opens the blood vessels so more blood fills the penis.", "Tikiti maji lina citrulline. Mwili unaigeuza kuwa nitric oxide, inayofungua mishipa ili damu nyingi ijae kwenye uume."],
  },
  "do-positions-last": {
    h: ["Change the angle, and you last longer while she enjoys it more. Swipe for all four.", "Ukibadilisha mkao, unadumu zaidi na yeye anapata raha zaidi. Telezesha uone yote minne."],
    w: ["These angles take pressure off the head of your penis and put it right where she feels it most.", "Mikao hii inapunguza msuguano kwenye kichwa cha uume wako, na inamgusa yeye pale anaposikia raha zaidi."],
  },
  "ig-garlic-before-bed": {
    h: ["Two or three cloves before you sleep. Fourteen nights. Wake up a lion.", "Punje mbili au tatu kabla ya kulala, kwa siku kumi na nne. Utaamka simba."],
    w: ["Garlic keeps your blood vessels clean, so more blood gets where it's needed. It's good for your semen too.", "Kitunguu swaumu kinasafisha mishipa ya damu, hivyo damu nyingi inafika pale inapohitajika. Pia kinasaidia mbegu zako."],
  },
  "do-squats": {
    h: ["Strong legs, strong erection. Eighty squats a day, split in four.", "Miguu imara, mashine imara. Squats 80 kwa siku, gawanya raundi nne."],
    w: ["Squats work the big muscles around your hips and pump blood straight to that area.", "Squats zinafanyisha kazi misuli mikubwa ya nyonga na kusukuma damu moja kwa moja huko chini."],
  },
  "ig-clove-ginger-garlic-tea": { h: ["She gets up from bed like nothing happened? Don't argue. Go to the kitchen.", "Anaamka kitandani kama hakuna kilichotokea? Usigombane naye. Ingia jikoni."] },
  "do-dont-rush": {
    h: ["Going straight for it is the number one mistake. Slow down, kaka.", "Kukimbilia moja kwa moja ndilo kosa kubwa kuliko yote. Punguza spidi, kaka."],
    w: ["Warm up her whole body first and everything after feels twice as strong to her.", "Ukiuandaa mwili wake wote kwanza, kila utakachofanya baadaye atakisikia mara mbili zaidi."],
  },
  "ig-dates-peanut-smoothie": {
    h: ["For the man who goes soft the moment it gets hot, and can't go again.", "Kwa mwanaume ambaye mashine inalala mara tu mambo yanapoanza kunoga, na hawezi kurudia."],
    w: ["Dates and bananas for quick energy, peanuts and black seed for stamina, milk to hold it together.", "Tende na ndizi zinakupa nguvu ya haraka, karanga na habbat sauda zinakupa stamina, maziwa yanaunganisha vyote."],
  },
  "do-21-day-reset": {
    h: ["Twenty-one days. A piece of paper in your wallet. A new you.", "Siku ishirini na moja. Kikaratasi kwenye pochi. Unakuwa mwanaume mpya."],
    w: ["Your brain believes what you repeat. Say it morning and night, and the old habit stops fitting who you are.", "Ubongo unaamini kile unachokirudia. Ukisema asubuhi na usiku, taratibu ile tabia ya zamani inakuwa haiendani na wewe tena."],
  },
  "do-warm-press-round-two": {
    h: ["Can't get it up for round two? Warm water and five minutes.", "Mashine imegoma bao la pili? Maji ya uvuguvugu na dakika tano."],
    w: ["Warmth opens the blood vessels, so blood rushes back in faster.", "Joto linafungua mishipa ya damu, na damu inarudi haraka."],
  },
  "ig-cinnamon-clove-tea": {
    h: ["Boil it down to one cup. Drink it half an hour before.", "Chemsha mpaka ibaki kikombe kimoja. Kunywa nusu saa kabla ya mechi."],
    w: ["Cloves and garlic push the blood, cinnamon cools the stress, ginger keeps the pipes clean.", "Karafuu na kitunguu swaumu vinasukuma damu, mdalasini unatuliza stress, tangawizi inasafisha njia."],
  },
  "do-deep-breathing": {
    h: ["Breathing fast? You'll finish fast. Slow your breath, slow your body.", "Unapumua haraka? Utamwaga haraka. Pumua taratibu, na mwili utatulia."],
    w: ["Slow breaths calm the nerves that fire when you're about to finish.", "Pumzi za taratibu zinatuliza ile mishipa inayokusukuma kumwaga."],
  },
  "ig-moringa-guava-tea": { h: ["Two handfuls of leaves from the garden, one litre of water. Strength from home.", "Viganja viwili vya majani kutoka shambani, lita moja ya maji. Nguvu za kiume kutoka nyumbani."] },
  "do-beetroot-drink": {
    h: ["Red, earthy, powerful. Beetroot helps blood flow.", "Beetroot: rangi nyekundu, nguvu tupu. Inasaidia damu kuzunguka vizuri."],
    w: ["Beetroot and spinach are packed with nitrates. Your body turns them into nitric oxide and the blood vessels open up.", "Beetroot na spinachi zimejaa nitrates. Mwili unazigeuza kuwa nitric oxide, na mishipa ya damu inafunguka."],
  },
  "do-kiss-lower-lip": { h: ["Most men kiss like they're in a hurry. Start with her lower lip.", "Wanaume wengi hubusu kama wanakimbizwa. Anza na mdomo wake wa chini."] },
  "ig-lemon-honey-jar": { h: ["Make it tonight, use it tomorrow morning. A little gift for your marriage.", "Tengeneza leo usiku, tumia kesho asubuhi. Zawadi ndogo kwa ndoa yako."] },
  "do-fruit-rotation": {
    h: ["Four fruits, morning and evening, for seven days. Simple food, big change.", "Matunda manne, asubuhi na jioni, siku saba. Chakula rahisi, mabadiliko makubwa."],
    w: ["Watermelon opens the vessels, avocado feeds your hormones, bananas and carrots keep the blood moving.", "Tikiti linafungua mishipa, parachichi linalisha homoni, ndizi na karoti zinafanya damu itembee."],
  },
  "ig-towel-lift": {
    h: ["A small towel and thirty lifts a day. Gym for down there.", "Taulo dogo, unaliinua mara 30 kwa siku. Ni gym ya huko chini."],
    w: ["Stronger muscles hold more blood, so it stands firmer and lasts longer.", "Misuli imara inashika damu zaidi, mashine inasimama imara na unadumu zaidi."],
  },
  "do-positions-her-first": {
    h: ["Let her finish first. Then you can relax and enjoy yours.", "Mfikishe yeye kwanza. Halafu wewe utulie, ufurahie zamu yako."],
    w: ["Women finish easier when the clitoris and G-spot both get attention, and when they set the pace.", "Wanawake hufika kileleni kwa urahisi kinembe na G-spot vikishughulikiwa pamoja, na pale wanapoachiwa waamue mwendo."],
  },
  "ig-watermelon-ginger-milk": { h: ["Swap the water for milk. For married men only, this one is strong.", "Badala ya maji, tumia maziwa. Hii ni kwa walioa tu, ni kali."] },
  "do-perineum-press": {
    h: ["There's a button between your legs that cools you down. Here's where.", "Kuna sehemu katikati ya miguu ukiibonyeza inakupoza. Ni hapa."],
    w: ["Pressing there blocks the signal to the muscles that push it out.", "Ukibonyeza pale, unazuia ishara inayokwenda kwenye misuli inayosukuma mzigo nje."],
  },
  "ig-cayenne-turmeric": { h: ["Hot, yellow, fast. Drink it an hour before, or every morning.", "Kali, ya njano, na inafanya kazi haraka. Kunywa saa moja kabla, au kila asubuhi."] },
  "do-urge-plan": {
    h: ["When the urge comes, don't sit there fighting it. Get up and move.", "Hamu ikija, usikae hapo ukipambana nayo. Inuka, toka hapo."],
    w: ["An idle mind goes back to the old habit. A busy body breaks it in minutes.", "Akili isiyo na kazi inarudi kwenye tabia ya zamani. Ukijishughulisha, hamu inakatika ndani ya dakika chache."],
  },
  "do-honey-jar": {
    h: ["Make one jar, use it for three weeks. Strength, stamina, and round two comes quicker.", "Tengeneza chupa moja, inakutosha wiki tatu. Nguvu, stamina, na bao la pili linakuja haraka."],
    w: ["Ginger and garlic for blood flow, black seed for energy, honey to carry it all.", "Tangawizi na kitunguu swaumu kwa damu, habbat sauda kwa nguvu, asali kuunganisha vyote."],
  },
  "ig-quit-porn-new-man": { h: ["Quitting starts in your head, not your hands. After that, you rebuild.", "Kuacha kunaanzia kichwani, si mikononi. Ukishaamua, unaanza kujijenga upya."] },
  "do-ears-neck": { h: ["Two spots almost every man forgets. Almost every woman loves them.", "Sehemu mbili ambazo karibu kila mwanaume huzisahau, na karibu kila mwanamke huzipenda."] },
  "ig-fertility-smoothie": {
    h: ["Trying for a baby? One glass a day for stronger, faster sperm.", "Mnatafuta mtoto? Glasi moja kwa siku kwa mbegu imara zinazokimbia kwa kasi."],
    w: ["Almonds protect the sperm, avocado feeds your hormones, milk brings calcium and vitamin D.", "Almond zinalinda mbegu, parachichi linalisha homoni, maziwa yanaleta calcium na vitamini D."],
  },
  "do-breath-reset": {
    h: ["Two breath-holds every morning. Your head clears, your discipline comes back.", "Bana pumzi mara mbili kila asubuhi. Akili inatulia, nidhamu inarudi."],
    w: ["Holding your breath on purpose calms the stress in your body and gives you a small win every morning.", "Kubana pumzi kwa makusudi kunatuliza stress mwilini na kukupa ushindi mdogo kila asubuhi."],
  },
  "ig-shaft-massage": { h: ["Years of porn left it soft? Warm cloth, oil, ten minutes every evening.", "Miaka ya punyeto imeiacha legelege? Kitambaa cha joto, mafuta, dakika kumi kila jioni."] },
  "do-half-strokes": {
    h: ["Her pleasure lives in the first five centimetres. Stop going deep all the time.", "Raha yake kubwa iko kwenye sentimita tano za mwanzo. Acha kuzamisha ndani muda wote."],
    w: ["The most sensitive nerves are near the entrance, and short strokes are easier on you.", "Mishipa yenye hisia nyingi iko karibu na mlango, na mapigo mafupi yanakusaidia wewe kudumu."],
  },
  "do-desire-onion-mix": { h: ["It stands, but the desire isn't there? One glass before bed.", "Mashine inasimama lakini hamu haipo? Glasi moja kabla ya kulala."] },
  "ig-beetroot-blood-flow": {
    h: ["A small red glass, three or four mornings a week. Keeps the machine strong.", "Glasi ndogo nyekundu, asubuhi tatu au nne kwa wiki. Mashine inabaki strong."],
    w: ["Beetroot opens the blood vessels; pomegranate and turmeric keep them healthy.", "Beetroot inafungua mishipa ya damu; komamanga na manjano zinaiweka katika hali nzuri."],
  },
  "do-breasts": { h: ["Here, soft and slow wins. Every time.", "Hapa, upole na utaratibu ndio vinavyoshinda. Kila mara."] },
  "ig-move-every-hour": { h: ["Sitting all day kills your blood flow. Stand up every hour.", "Kukaa siku nzima kunaua mzunguko wa damu. Simama kila saa."] },
  "do-jelq": {
    h: ["Ten to fifteen minutes a day. Firmer and fuller in about a month.", "Dakika 10 hadi 15 kwa siku. Ndani ya mwezi mmoja hivi, imara zaidi na imejaa zaidi."],
    w: ["Moving blood along the shaft stretches the parts that fill up when you're hard, so they hold more.", "Kusukuma damu kwenye shina kunatanua sehemu zinazojaa ukisimama, zinashika damu zaidi."],
  },
  "do-count-backwards": { h: ["100, 97, 94… Give your mind a job and the urge backs off.", "100, 97, 94… Ipe akili kazi nyingine, hamu inashuka."] },
  "ig-light-dinner": { h: ["Big plate of ugali at 9 pm? You'll sleep, not play. Eat light.", "Sahani kubwa ya ugali saa tatu usiku? Utalala, hutacheza. Kula chakula chepesi."] },
  "do-pomegranate-garlic": { h: ["A glass of pomegranate, one clove of garlic. Sip it slowly before dinner.", "Glasi ya komamanga, punje moja ya kitunguu swaumu. Kunywa taratibu kabla ya chakula."] },
  "ig-satisfy-her-7": { h: ["Satisfying her isn't luck. It's a skill, and you can learn it.", "Kumridhisha si bahati. Ni ujuzi, na unaweza kuujifunza."] },
  "do-read-her-body": { h: ["She's already telling you what she wants. You just have to look.", "Tayari anakuonyesha anachotaka. Kazi yako ni kuangalia tu."] },
  "ig-90-day-routine": { h: ["Ten habits, every day, for ninety days. Your testosterone will thank you.", "Tabia kumi, kila siku, kwa siku tisini. Utaona testosterone yako ikipanda."] },
  "do-cut-7-foods": { h: ["Some of the food you eat every day is quietly killing your power.", "Baadhi ya vyakula unavyokula kila siku vinakumaliza nguvu kimyakimya."] },
  "do-testicles-down": {
    h: ["Right before you finish, your balls pull up. Gently bring them down.", "Kabla tu ya kumwaga, korodani hupanda juu. Zishushe taratibu."],
    w: ["They rise to get ready to shoot. Easing them down slows the whole thing.", "Zinapanda zikijiandaa kumwaga. Ukizishusha, kila kitu kinapoa."],
  },
  "ig-pre-game-juice": { h: ["Ginger, garlic, onion, one glass of water. Drink it an hour before.", "Tangawizi, kitunguu swaumu, kitunguu maji, glasi ya maji. Kunywa saa moja kabla."] },
  "do-warm-cloth": { h: ["A warm cloth, twice a day. It wakes up the blood and gets you used to her heat.", "Kitambaa cha joto, mara mbili kwa siku. Kinaamsha damu na kukuzoesha joto lake."] },
  "ig-hibiscus-tea": { h: ["Rozela tea, hot or cold. Even better if you drink it together.", "Chai ya rozela, ya moto au baridi. Bora zaidi mkinywa pamoja."] },
  "do-inner-thighs": { h: ["Get close to where she wants you… then move away. Make her wait.", "Sogea karibu na pale anapokutaka… kisha rudi nyuma. Mfanye asubiri."] },
  "ig-power-powder": { h: ["Mix it once, keep it in a jar. One spoon a day in water, milk or uji.", "Changanya mara moja, weka kwenye chupa. Kijiko kimoja kwa siku kwenye maji, maziwa au uji."] },
  "do-orange-turmeric": {
    h: ["Three oranges, a spoon of turmeric, a pinch of pepper. Three minutes.", "Machungwa matatu, kijiko cha manjano, chembe ya pilipili manga. Dakika tatu."],
    w: ["The pepper helps your body take in the turmeric, and turmeric keeps the blood vessels calm.", "Pilipili manga inasaidia mwili kunyonya manjano, na manjano inatuliza mishipa ya damu."],
  },
  "do-self-talk": {
    h: ["If you go in scared, you'll finish fast. Fix your head first.", "Ukiingia na woga, utamaliza haraka. Rekebisha kichwa kwanza."],
    w: ["Finishing early usually starts in the mind: fear, worry, pressure. A calm head gives you a calm body.", "Kuwahi kumwaga mara nyingi kunaanzia akilini: woga, wasiwasi, presha. Ukituliza kichwa, mwili nao unatulia."],
  },
  "ig-7-day-semen-plan": { h: ["Seven days: fruit, eggs, garlic and one strong drink. No porn.", "Siku saba: matunda, mayai, kitunguu swaumu na kinywaji kimoja cha nguvu. Hakuna punyeto."] },
  "do-cut-triggers": { h: ["What you feed your eyes, you'll get back. Change what goes in.", "Unachoangalia ndicho kinachokujenga au kukubomoa. Badilisha unachoangalia."] },
  "ig-guava-leaf-semen": { h: ["Young guava leaves for a week, and a short break before her fertile days.", "Majani machanga ya mpera kwa wiki moja, na mapumziko kidogo kabla ya siku zake za hatari."] },
  "do-feet-knees": { h: ["Her feet are full of nerves, and almost nobody touches them. Be the one.", "Nyayo zake zimejaa mishipa ya hisia, na karibu hakuna anayezigusa. Wewe kuwa wa kwanza."] },
  "ig-ginseng-clove-tea": {
    h: ["Drink it hot, then relax and wait for showtime. No sugar.", "Kunywa ikiwa ya moto, kisha tulia usubiri shoo. Bila sukari."],
    w: ["Ginseng gives you staying power; cloves and ginger push the blood.", "Ginseng inakupa uwezo wa kudumu; karafuu na tangawizi zinasukuma damu."],
  },
  "do-garlic-milk": { h: ["Can't stand raw garlic? Boil it in milk. Same power, easier taste.", "Huwezi kitunguu swaumu kibichi? Chemsha kwenye maziwa. Nguvu ileile, ladha laini."] },
  "do-sleep": { h: ["Your body builds testosterone while you sleep. Short nights, weak mornings.", "Mwili unatengeneza testosterone ukiwa umelala. Ukilala kidogo, asubuhi unaamka dhaifu."] },
  "ig-onion-water": {
    h: ["Four onions, three cups of water, twelve hours. A favourite for libido.", "Vitunguu maji vinne, vikombe vitatu vya maji, masaa kumi na mawili. Kiboko ya hamu."],
    w: ["Onions carry zinc and vitamin E, and help the blood move.", "Vitunguu maji vina zinki na vitamini E, na vinasaidia damu kutembea."],
  },
  "do-ask-her": { h: ["Few men ask her this. Every woman remembers the one who did.", "Wanaume wachache humuuliza hili. Na kila mwanamke humkumbuka yule aliyemuuliza."] },
  "ig-moringa-desire": { h: ["Moringa, morning and evening. As tea or as powder in milk.", "Mlonge, asubuhi na jioni. Kama chai au unga kwenye maziwa."] },
  "do-green-drink": { h: ["Green, cold and fresh. Your blood vessels like this one.", "Kijani, baridi na fresh. Ni kizuri kwa mishipa yako ya damu."] },
  "ig-confidence-plan": { h: ["Beautiful woman, you want her, but it won't cooperate? Start here.", "Mwanamke mzuri yuko mbele yako, unamtaka, lakini mashine inagoma? Anza hapa."] },
  "do-belly": {
    h: ["Every kilo off your belly shows more of you. Literally.", "Kila kilo ya kitambi unayopunguza, mashine inaonekana kubwa zaidi. Sio utani."],
    w: ["Belly fat hides the base of the penis and turns your testosterone into estrogen.", "Mafuta ya tumbo yanaficha shina la mashine na kugeuza testosterone yako kuwa estrogen."],
  },
  "do-face-forehead": { h: ["Hold her face and smile. Simple, and she'll feel truly wanted.", "Shika uso wake, mtazame, tabasamu. Rahisi tu, lakini atajisikia anapendwa kweli."] },
  "ig-coconut-egg-nightcap": { h: ["One glass before bed, seven nights in a row. An old favourite.", "Glasi moja kabla ya kulala, usiku saba mfululizo. Dawa ya enzi za mababu."] },
  "do-natural-breakfast": { h: ["Chai with sugar and mandazi won't build you. Try this instead.", "Chai ya sukari na maandazi havitakujenga. Jaribu hiki badala yake."] },
  "ig-bitter-kola": { h: ["Bitter kola and ginger, 30 minutes before. You'll be back in the game fast.", "Bitter kola na tangawizi, dakika 30 kabla. Utarudi kwenye game haraka."] },
  "do-nut-seed-paste": {
    h: ["Peanuts and pumpkin seeds with honey. One spoon a day for thicker semen.", "Karanga na mbegu za maboga kwenye asali. Kijiko kimoja kwa siku, mbegu zinakuwa nzito."],
    w: ["Both are full of zinc, and zinc goes straight to the parts that make semen.", "Vyote vimejaa zinki, na zinki huenda moja kwa moja kwenye sehemu zinazotengeneza mbegu."],
  },
  "ig-seed-milk": {
    h: ["Semen watery like thin uji? Seeds and nuts in hot milk, morning and night.", "Mbegu nyepesi kama uji wa mgonjwa? Mbegu na njugu kwenye maziwa ya moto, asubuhi na usiku."],
    w: ["Zinc builds semen, omega-3 makes it strong, arginine helps blood flow, vitamin E protects it all.", "Zinki inajenga mbegu, omega-3 inazifanya ziwe imara, arginine inasaidia damu, vitamini E inalinda vyote."],
  },
  "do-onion-ginger-glass": { h: ["Morning and evening, one glass. Strength without pills.", "Asubuhi na jioni, glasi moja. Nguvu bila vidonge."] },
  "do-hips-navel": { h: ["Most men skip her belly and hips. She notices.", "Wanaume wengi huruka tumbo na nyonga zake. Na yeye anaona."] },
  "ig-ginger-green-tea": { h: ["Ginger and green tea, morning and night. No boosters needed.", "Tangawizi na chai ya kijani, asubuhi na usiku. Huhitaji booster."] },
  "do-slow-start-sensitive": { h: ["Ten slow minutes here and she'll be the one pulling you in.", "Dakika kumi za taratibu hapa, yeye ndiye atakuvuta ndani."] },
  "ig-testosterone-habits": { h: ["There's no shortcut. Six things, every day. Your body is a temple.", "Hakuna njia ya mkato. Mambo sita, kila siku. Mwili wako ni hekalu."] },
  "do-leave-stress": {
    h: ["Bringing the day's anger to bed? That's why you finish fast.", "Unaleta hasira za mchana kitandani? Ndiyo maana unawahi kumaliza."],
    w: ["Most early finishing comes from the head, not the body. A calm mind gives you a body that lasts.", "Kuwahi kumaliza mara nyingi kunatoka kichwani, si mwilini. Akili tulivu inakupa mwili unaodumu."],
  },
  "ig-clove-cinnamon-milk": {
    h: ["Warm milk with clove and cinnamon after dinner. Two or three nights a week.", "Maziwa ya moto yenye karafuu na mdalasini baada ya chakula cha usiku. Usiku mbili au tatu kwa wiki."],
    w: ["Clove and cinnamon push the blood and calm you down. Even the smell puts you in the mood.", "Karafuu na mdalasini vinasukuma damu na kukutuliza. Hata harufu yake inaamsha hisia."],
  },
  "do-regular-sex": { h: ["Lasting longer is practice. The more you two do it, the better you get.", "Kudumu ni mazoezi. Kadri mnavyofanya mara kwa mara, ndivyo unavyozidi kuwa fundi."] },
  "do-water-by-weight": { h: ["Your blood is mostly water. Dry body, weak erection.", "Damu yako kwa sehemu kubwa ni maji. Mwili mkavu, mashine dhaifu."] },
  "ig-honey-blend-msamitu": { h: ["The big one. Two spoons in the morning, three at night, for two weeks.", "Hii ndio kiboko yao. Vijiko viwili asubuhi, vitatu usiku, kwa wiki mbili."] },
};
