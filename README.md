# fit-lab

fit-lab is a free web tool that reads your real starting point, tells you whether the goal you have in mind is achievable and roughly how long it would take, and gives you the right exercises per muscle group for a gym or a bare floor. It is built for people in India who have no reliable source of truth about their own bodies. It runs entirely in your browser.

## Why it is free, and why that is the point

Every fitness product in India is paid for by aspiration. cult.fit sells classes. HealthifyMe and Fittr sell coaches. GOQii sells a band. MuscleBlaze and Nutrabay sell powder. The trainer at your local gym earns most of his income on supplement commission.

A product whose revenue depends on you believing the goal is achievable cannot tell you the goal is not achievable. That is not a claim about anyone's character. It is a claim about incentives, and incentives win.

I surveyed the market. MacroFactor flags an unsafe rate of weight loss, but that is calorie math and nothing more. RP Hypertrophy implies a ceiling through volume landmarks without ever stating one. Strength Level lets you infer it from percentiles. cult.fit, HealthifyMe, Fittr, GOQii, Fitbod, Freeletics, Nike Training Club, Centr, Hevy, Strong and JEFIT do not do it at all. None of them will tell you your goal is unrealistic.

So the honest position is unoccupied, and it is unoccupied because it cannot be monetised. That is exactly why I can take it. fit-lab has nothing to sell you, so it can afford to say "that will take fourteen months, not eight weeks."

## The loop

1. **Read the starting point.** Height, weight, age, sex, waist, neck, hip. A tape measure. No smart scale, no wearable, no login.
2. **Screen for safety.** Based on the PAR-Q+ framework and the post-2015 ACSM algorithm. The 2015 revision deliberately refers fewer people to a doctor than the old blanket "consult your physician" line, because that line deters exercise and that costs more health than it saves.
3. **Reality-check the goal, in both directions.** Too high is the obvious failure. Too low is the common one. Light dumbbells, twenty comfortable reps, the same routine for six months, no result. Sets stopped five or more reps short of failure produce substantially blunted growth, and roughly ten hard sets per muscle per week is the threshold below which the work barely counts. Nobody tells people this. They are told to be patient instead.
4. **Give the right exercises per muscle group**, for a gym or for a bare floor, with the ranking criteria stated on the page. Exercises, not a schedule.

## What it is not

fit-lab is an assessment, not a programme generator. It will not hand you a week-by-week plan to follow, and it will not tell you what to lift on Tuesday.

That is a decision, not a gap. The moment this becomes a programme it competes with Fitbod and Freeletics on features, and that is a race about scheduling logic, not about honesty. As an assessment it competes with nobody, because nobody is doing it. A programme layer may come later, once the assessment has earned enough trust to deserve one. For v1 it is deliberately out of scope rather than merely unbuilt.

## What it refuses to do

- It does not diagnose. It screens, and screening is not diagnosis.
- It does not sell anything. No supplements, no coaching, no premium tier, no affiliate links.
- It does not store or transmit your data. There is no server holding anything, because there is no server.
- It does not promise a timeline the evidence cannot support.
- It does not rank exercises on evidence it does not have.

## Where the numbers come from

| What | Source | Note |
|---|---|---|
| BMI cut-offs 23 and 27.5 for Asians, not 25 and 30 | WHO Expert Consultation, *Lancet* 2004;363(9403):157–163. PMID 14726171 | Abstract directly verified |
| Indian obesity definition, two stages | Misra A et al., *Diabetes & Metabolic Syndrome* 2025;19(1):102989. PMID 39814628 | Stage 1 is BMI >23 with no functional or organ effect. Stage 2 needs BMI >23 **plus** raised waist or waist-to-height **plus** a functional limitation or an obesity-related comorbidity |
| Waist-to-height ratio ≥0.5 as elevated risk | Ashwell M, Gunn P, Gibson S, *Obes Rev* 2012;13(3):275–286 | Needs no scale, only a tape. Not fetch-verified |
| Body fat estimate from circumferences | US Navy formula. Hodgdon JA, Beckett MB, Naval Health Research Center Report 84–29, 1984 | Standard error around 3.5–4.5% body fat. Never validated in South Asians |
| FFMI as a rough natural ceiling | Kouri EM, Pope HG, Katz DL, Oliva PS, *Clin J Sport Med* 1995;5(4):223–228 | See known limits below |
| Rate of muscle gain by training year | Lyle McDonald and Alan Aragon models | **Practitioner models, not trials.** No RCT validation |
| Fat loss 0.5–1% bodyweight per week | Garthe I et al., *Int J Sport Nutr Exerc Metab* 2011;21(2):97–104, PMID 21558571; Helms ER, Aragon AA, Fitschen PJ, *J Int Soc Sports Nutr* 2014;11:20, PMID 25028958 | Slower loss preserved lean mass and strength; faster loss did not |
| 150–300 min moderate activity per week | WHO Guidelines on Physical Activity and Sedentary Behaviour, 2020 | Publication verified |
| Pre-exercise safety screening | PAR-Q+ (CSEP, eparmedx.com); Riebe D et al., ACSM screening update, *Med Sci Sports Exerc* 2015;47(11):2473–2479, PMID 26473759 | PAR-Q+ structure verified. Embedding rights to be confirmed with CSEP |
| Protein RDA 0.83 g/kg/day | ICMR-NIN, *Dietary Guidelines for Indians*, 2024 | This is the sedentary minimum, not a training target |

Several of these were cited from published literature but could not be fetched directly during research. Where that is the case it is marked above, and it will be marked on the site too.

## Known limits

- **The rate-of-gain models were built on predominantly white North American cohorts.** There is essentially no South Asian data on rates of muscle gain. The models are the best available and they are still an extrapolation.
- **FFMI around 25 rests on 74 natural athletes measured in 1995.** Selected, motivated, not population-representative, and pre-dating modern nutrition and periodisation. It is a reference point, not a limit.
- **A tape measurement carries ±2–5 cm of error**, which is enough to move someone across a threshold. Every number derived from a tape is shown as a band.
- **"Best exercise per muscle group" is a weaker claim than it sounds.** Most published rankings trace back to EMG activation studies, and EMG amplitude is not hypertrophy. So fit-lab does not rank on EMG. It ranks on stated criteria: whether you can progressively overload it, whether it loads the muscle in a lengthened position, whether it is safe to do unsupervised, and whether you can actually get at the equipment.
- Some things genuinely cannot be trained at home with nothing. Back and biceps need something to pull against. A cheap resistance band changes the answer, and saying so is more useful than a workaround that does not work.

## Data

Exercise data comes from [`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db). I checked the licence: Unlicense, true public domain, no attribution obligation and no share-alike. 873 exercises with structured fields and step-by-step instructions.

The gaps are real and I am not going to paper over them:

- Only **131 of the 873** need no equipment. The home case is thinnest exactly where this product needs it most.
- **Glutes have 22 primary exercises. Quads have 148.** Coverage is badly lopsided.
- There is no Indian context, no floor-only constraint, no small-flat or no-noise variants.

So the curation has to be done by hand. That curation is the design work, not a chore before it.

MuscleWiki and ExRx were ruled out as proprietary, exercisedb.io is paid, and wger is CC BY-SA, which is usable but adds obligations for little gain.

## Licence

The code is free to learn from and reuse. The writing is mine.
