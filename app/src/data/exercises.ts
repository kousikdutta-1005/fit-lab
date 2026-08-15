/**
 * The evidence-backed exercise catalogue.
 *
 * This replaces the earlier hand-built "10 muscle groups, pick some
 * exercises" placeholder. Every shippable entry here maps to a `CapacityId`
 * (a movement/physiological demand, not a body part), carries an explicit
 * evidence tier and certainty class, cites its `Source`s, and points at a
 * verified `TechniqueGuide`. Nothing here is invented: guide URLs and their
 * `expectedContent` were live-verified (see scripts/validate-guides.mjs and
 * data/evidence.ts).
 *
 * `MuscleId`/`MUSCLES`/`Place` are kept byte-for-byte compatible with the
 * prior catalogue: the anatomy validator, the 3D muscle scene and the Goal
 * screen all depend on this exact 10-id list existing and rendering.
 * Capacities map onto these ids for display; abstract capacities
 * (aerobic_base, balance, mobility) render no anatomy at all, which is
 * intentional — an abstract capacity does not get papered over with a fake
 * muscle-group mapping.
 */

import type { CapacityId } from "./capacities.ts"

export type MuscleId =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"

export const MUSCLES: { id: MuscleId; label: string; plain: string }[] = [
  { id: "chest", label: "Chest", plain: "The front of your upper body" },
  { id: "back", label: "Back", plain: "Everything you pull with" },
  { id: "shoulders", label: "Shoulders", plain: "The caps on top of your arms" },
  { id: "biceps", label: "Biceps", plain: "Front of the upper arm" },
  { id: "triceps", label: "Triceps", plain: "Back of the upper arm" },
  { id: "quads", label: "Quads", plain: "Front of the thigh" },
  { id: "hamstrings", label: "Hamstrings", plain: "Back of the thigh" },
  { id: "glutes", label: "Glutes", plain: "Hips and backside" },
  { id: "calves", label: "Calves", plain: "Lower leg" },
  { id: "core", label: "Core", plain: "Midsection, front and sides" },
]

export type Place = "home-gym" | "commercial-gym"

export type EvidenceCertainty =
  /** Guideline-level consensus (e.g. WHO/ACSM position stands). */
  | "established"
  /** A specific trial/meta-analysis shows the effect, single line of evidence. */
  | "probable"
  /** Association/observational only — explicitly never claimed as causal. */
  | "limited"
  /** Biomechanical/EMG/joint-mechanics inference, no direct outcome trial. */
  | "mechanistic"
  /** Evidence drawn from athletes/a sport, applied to general users. */
  | "extrapolated"

export type EvidenceTier = "S" | "A" | "B"

export type Exercise = {
  id: string
  name: string
  capacity: CapacityId
  environments: Place[]
  tier: EvidenceTier
  evidenceCertainty: EvidenceCertainty
  sourceIds: string[]
  guideId: string
  /** Referral-only companion links (e.g. trip prep, water safety) — never dosed. */
  referralGuideIds?: string[]
  /** Set when this variant is the degraded/home-ceiling substitute — see data/kit.ts. */
  homeCeilingId?: string
  /** Needs a ramped starting volume (Nordic curl, Copenhagen adduction...). */
  highDoms?: boolean
  /** Contains jumping/impact — gated behind joint-pain/pregnancy flags. */
  impact?: boolean
  quiet: boolean
  /** Plain-language requirement to complete before this is offered (emphasis-gated items only). */
  prerequisite?: string
  /** The specific, honestly-scoped evidence claim shown to the reader. */
  why: string
  quarantined?: { reason: string }
}

export const EXERCISES: Exercise[] = [
  // ── aerobic_base ──
  {
    id: "aerobic-base",
    name: "Brisk walking, jogging or cycling",
    capacity: "aerobic_base",
    environments: ["home-gym", "commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["who-2020-physical-activity", "momma-2022-dose-response"],
    guideId: "g-nhs-walking",
    quiet: false,
    why: "150–300 min/week of moderate aerobic activity is guideline-established for lower all-cause mortality risk.",
  },

  // ── knee_extension (squat) ──
  {
    id: "squat-home",
    name: "Goblet squat",
    capacity: "knee_extension",
    environments: ["home-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-aaos-knee",
    quiet: true,
    why: "The squat/knee-extension pattern is core resistance-training coverage in every major guideline.",
  },
  {
    id: "squat-commercial",
    name: "Barbell front squat",
    capacity: "knee_extension",
    environments: ["commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand", "watson-2018-liftmor-bone"],
    guideId: "g-ace-front-squat",
    quiet: false,
    why: "A rack lets this pattern progress to a genuinely heavy load, which matters for the bone-stimulus ceiling home training can't reach.",
  },

  // ── hip_hinge ──
  {
    id: "hinge-home",
    name: "Dumbbell hip hinge",
    capacity: "hip_hinge",
    environments: ["home-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand", "plotkin-2023-hip-thrust"],
    guideId: "g-ace-hip-hinge",
    quiet: true,
    why: "Squat and hip-thrust patterns build comparable gluteal size — a dumbbell hinge is a genuine substitute, not a compromise.",
  },
  {
    id: "hinge-commercial",
    name: "Barbell Romanian deadlift / hip thrust",
    capacity: "hip_hinge",
    environments: ["commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand", "plotkin-2023-hip-thrust"],
    guideId: "g-ace-hip-hinge",
    quiet: false,
    why: "Barbell loading lets the hinge pattern progress well past what dumbbells alone allow.",
  },

  // ── knee_flexion ──
  {
    id: "nordic-curl-home",
    name: "Assisted Nordic hamstring curl",
    capacity: "knee_flexion",
    environments: ["home-gym"],
    tier: "A",
    evidenceCertainty: "probable",
    sourceIds: ["vandyk-2019-nordic"],
    guideId: "g-aspetar-nordic",
    homeCeilingId: "ceiling-hip-flexed-knee-flexion",
    highDoms: true,
    quiet: true,
    why: "Nordic curls cut hamstring-injury risk in trials (RR ~0.49); a bodyweight Nordic doesn't fully match a seated leg-curl machine's loading of the long head.",
  },
  {
    id: "leg-curl-commercial",
    name: "Seated or prone leg curl",
    capacity: "knee_flexion",
    environments: ["commercial-gym"],
    tier: "S",
    evidenceCertainty: "probable",
    sourceIds: ["maeo-2021-leg-curl"],
    guideId: "g-aaos-knee",
    quiet: true,
    why: "A leg-curl machine loads the long head of the hamstring more directly than any bodyweight hip-flexed variant.",
  },

  // ── horizontal_push ──
  {
    id: "incline-press",
    name: "Incline dumbbell press",
    capacity: "horizontal_push",
    environments: ["home-gym", "commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-incline-chest-press",
    quiet: true,
    why: "A dumbbell incline press covers the horizontal-push pattern with a full, coachable range of motion in either environment.",
  },
  {
    id: "pushup-regression",
    name: "Push-up",
    capacity: "horizontal_push",
    environments: ["home-gym"],
    tier: "B",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-push-up",
    quiet: true,
    why: "A genuine no-equipment fallback for the same pattern, for the days a dumbbell isn't handy.",
  },

  // ── vertical_push ──
  {
    id: "overhead-press",
    name: "Seated dumbbell overhead press",
    capacity: "vertical_push",
    environments: ["home-gym", "commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-seated-overhead-press",
    quiet: true,
    why: "The straightforward way to load the shoulder overhead without a rack, and scales fine at a gym too.",
  },

  // ── horizontal_pull ──
  {
    id: "row-home",
    name: "One-arm dumbbell bent-over row",
    capacity: "horizontal_pull",
    environments: ["home-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-bent-over-row",
    quiet: true,
    why: "Loads a genuine horizontal-pull pattern with nothing but a dumbbell and a bench or knee for support.",
  },
  {
    id: "row-commercial",
    name: "Barbell or cable row",
    capacity: "horizontal_pull",
    environments: ["commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-bent-over-row",
    quiet: false,
    why: "Same pattern, with a cable or barbell letting the load progress in smaller, more precise steps.",
  },

  // ── vertical_pull ──
  {
    id: "vertical-pull-home",
    name: "Pull-up (structurally-mounted bar) or rated-band pulldown",
    capacity: "vertical_pull",
    environments: ["home-gym"],
    tier: "A",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-nasm-pull-up",
    homeCeilingId: "ceiling-unsafe-vertical-pull",
    quiet: true,
    why: "Use a pull-up bar only where the mounting is confirmed structurally safe; otherwise a rated band anchor gives a real, if lighter, vertical-pull substitute.",
  },
  {
    id: "pull-up-commercial",
    name: "Pull-up or lat pulldown machine",
    capacity: "vertical_pull",
    environments: ["commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-nasm-pull-up",
    quiet: false,
    why: "A lat-pulldown stack lets the vertical-pull pattern be dosed precisely from day one, which a bodyweight pull-up cannot.",
  },

  // ── hip_ab_ad ──
  {
    id: "hip-adduction",
    name: "Standing hip adduction / abduction",
    capacity: "hip_ab_ad",
    environments: ["home-gym", "commercial-gym"],
    tier: "A",
    evidenceCertainty: "established",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-standing-hip-adduction",
    quiet: true,
    why: "Directly trains the side-to-side hip strength general resistance-training coverage calls for.",
  },

  // ── calf_soleus ──
  {
    id: "calf-raise-home",
    name: "Standing dumbbell calf raise",
    capacity: "calf_soleus",
    environments: ["home-gym"],
    tier: "A",
    evidenceCertainty: "probable",
    sourceIds: ["kinoshita-2023-soleus"],
    guideId: "g-nhs-strength",
    homeCeilingId: "ceiling-heavy-soleus",
    quiet: true,
    why: "Standing and seated calf raises grow the soleus comparably at moderate load; a seated machine still out-loads a standing raise at the heavy end.",
  },
  {
    id: "calf-raise-commercial",
    name: "Seated calf raise machine",
    capacity: "calf_soleus",
    environments: ["commercial-gym"],
    tier: "S",
    evidenceCertainty: "probable",
    sourceIds: ["kinoshita-2023-soleus"],
    guideId: "g-aaos-foot-ankle",
    quiet: true,
    why: "A knee-flexed seated position lets soleus loading progress further than standing alone.",
  },

  // ── scapular_cuff ──
  {
    id: "scapular-cuff",
    name: "Scapular and rotator-cuff conditioning set",
    capacity: "scapular_cuff",
    environments: ["home-gym", "commercial-gym"],
    tier: "A",
    evidenceCertainty: "probable",
    sourceIds: ["andersson-2017-rotator-cuff"],
    guideId: "g-aaos-shoulder",
    quiet: true,
    why: "Scapular/cuff work showed a benefit trend for shoulder pain in office workers, though the trial was underpowered to reach significance.",
  },

  // ── grip_carry ──
  {
    id: "suitcase-carry",
    name: "Suitcase carry",
    capacity: "grip_carry",
    environments: ["home-gym", "commercial-gym"],
    tier: "S",
    evidenceCertainty: "limited",
    sourceIds: ["leong-2015-pure-grip", "hse-manual-handling", "cochrane-manual-handling-cd005958"],
    guideId: "g-ace-suitcase-carry",
    quiet: true,
    why: "Lower grip strength is associated with higher mortality risk (an ageing biomarker, not a proven lever) — carries still build genuinely useful grip/trunk strength either way. Manual-handling technique training itself is not shown to prevent back pain.",
  },

  // ── trunk_control ──
  {
    id: "bird-dog",
    name: "Bird dog",
    capacity: "trunk_control",
    environments: ["home-gym", "commercial-gym"],
    tier: "S",
    evidenceCertainty: "probable",
    sourceIds: ["lauersen-2018-general-strength"],
    guideId: "g-ace-bird-dog",
    quiet: true,
    why: "General strength/stability work like this is linked to a meaningfully lower overuse-injury rate, as a class, not as a single-exercise guarantee.",
  },
  {
    id: "side-plank",
    name: "Side plank",
    capacity: "trunk_control",
    environments: ["home-gym", "commercial-gym"],
    tier: "A",
    evidenceCertainty: "probable",
    sourceIds: ["lauersen-2018-general-strength"],
    guideId: "g-ace-side-plank",
    quiet: true,
    why: "Trains anti-lateral-flexion trunk control, the companion demand to bird dog's anti-rotation.",
  },

  // ── balance (conditional: age >= 65) ──
  {
    id: "balance-work",
    name: "Standing balance practice",
    capacity: "balance",
    environments: ["home-gym", "commercial-gym"],
    tier: "S",
    evidenceCertainty: "probable",
    sourceIds: ["sherrington-2019-falls-cochrane"],
    guideId: "g-nhs-balance",
    quiet: true,
    why: "Balance/functional exercise lowers the falls rate in trials (RaR ~0.76); resistance training or walking alone did not show the same effect.",
  },

  // ── mobility (universal low-cost bonus, always included) ──
  {
    id: "cat-cow",
    name: "Cat-cow",
    capacity: "mobility",
    environments: ["home-gym", "commercial-gym"],
    tier: "A",
    evidenceCertainty: "mechanistic",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-cat-cow",
    quiet: true,
    why: "Everyday spinal range of motion — useful for day-to-day comfort, not a distinct injury-prevention mechanism on its own.",
  },
  {
    id: "downward-dog",
    name: "Downward facing dog",
    capacity: "mobility",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "mechanistic",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-downward-dog",
    quiet: true,
    why: "A whole-posterior-chain stretch/mobility position; yoga is a useful modality here, not a unique longevity mechanism.",
  },

  // ── optional: running emphasis ──
  {
    id: "run-progression",
    name: "Couch to 5K structured progression",
    capacity: "run_progression",
    environments: ["home-gym", "commercial-gym"],
    tier: "S",
    evidenceCertainty: "established",
    sourceIds: ["who-2020-physical-activity"],
    guideId: "g-nhs-c25k",
    quiet: false,
    why: "A guideline-backed, gradual way to build a running base without outrunning your tissue tolerance.",
  },
  {
    id: "run-hamstring-resilience",
    name: "Nordic hamstring curl (running-specific framing)",
    capacity: "run_hamstring_resilience",
    environments: ["home-gym", "commercial-gym"],
    tier: "A",
    evidenceCertainty: "probable",
    sourceIds: ["vandyk-2019-nordic", "leppanen-2024-hip-core"],
    guideId: "g-aspetar-nordic",
    highDoms: true,
    quiet: true,
    why: "Hip/core and hamstring-specific strength programmes are linked to lower running-injury hazard (HR ~0.66 / RR ~0.49) in runners specifically.",
  },
  {
    id: "run-strides",
    name: "Short fast strides",
    capacity: "run_strides",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "extrapolated",
    sourceIds: ["balachandran-2022-power"],
    guideId: "g-nhs-c25k",
    prerequisite: "8 consecutive weeks of easy continuous running",
    impact: true,
    quiet: false,
    why: "Fast-intent efforts show a modest power benefit in trials of older adults; here they are gated behind an aerobic base rather than offered as a starting point.",
  },

  // ── optional: boxing emphasis (explicitly extrapolated; no injury-prevention claim) ──
  {
    id: "boxing-grip-forearm",
    name: "Wrist curl (forearm/grip resilience)",
    capacity: "boxing_grip_forearm",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "extrapolated",
    sourceIds: ["acsm-2026-position-stand"],
    guideId: "g-ace-wrist-curl",
    quiet: true,
    why: "General forearm strength only — there is no direct injury-prevention RCT basis for grip or wrist work against boxing hand injury; this is explicitly extrapolated, not a protective claim.",
  },
  {
    id: "boxing-conditioning",
    name: "Controlled conditioning intervals",
    capacity: "boxing_conditioning",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "extrapolated",
    sourceIds: ["who-2020-physical-activity", "momma-2022-dose-response"],
    guideId: "g-nhs-walking",
    prerequisite: "An established aerobic base",
    quiet: false,
    why: "Short, controlled hard efforts on top of an aerobic base — general conditioning support for boxing training, not a boxing-specific or injury-preventive claim.",
  },

  // ── optional: climbing & outdoors emphasis ──
  {
    id: "outdoors-loaded-walk",
    name: "Loaded carry / rucking-style walk",
    capacity: "outdoors_loaded_carry_walk",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "limited",
    sourceIds: ["hse-manual-handling", "cochrane-manual-handling-cd005958"],
    guideId: "g-nhs-walking",
    referralGuideIds: ["g-nps-ten-essentials"],
    quiet: false,
    why: "A loaded walk builds general carrying capacity; rucking is not shown to be superior to plain walking, and load should follow the HSE manual-handling limits, not exceed them.",
  },
  {
    id: "outdoors-trip-prep",
    name: "Trip preparation (planning, not training)",
    capacity: "outdoors_trip_prep",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "established",
    sourceIds: [],
    guideId: "g-nps-ten-essentials",
    quiet: false,
    prerequisite: "N/A — a planning checklist, not an exercise",
    why: "Fitness prepares capacity, not judgement or trip planning; this is a referral to the official checklist, not something this app teaches.",
  },
  {
    id: "outdoors-landing-awareness",
    name: "Climbing/bouldering landing & safety referral",
    capacity: "outdoors_landing_awareness",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "established",
    sourceIds: [],
    guideId: "g-bmc-climb-start",
    referralGuideIds: ["g-bmctv-landing", "g-rlss-water-safety"],
    quiet: false,
    prerequisite: "N/A — a safety referral, not an exercise this app teaches",
    why: "Climbing technique, spotting/landing and water competency are taught skills this app does not teach; these are official referrals, not in-app instruction.",
  },

  // ── quarantined: no valid guide, or claim not supportable ──
  {
    id: "crawling-locomotion",
    name: "Quadrupedal crawling",
    capacity: "trunk_control",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "mechanistic",
    sourceIds: [],
    guideId: "",
    quiet: true,
    why: "Quarantined: no verified primary technique guide from a credentialed source, and 'restores primal movement' is unsupported mechanistic inference.",
    quarantined: { reason: "No verified primary guide meeting the authority/format bar; claim is unsupported inference." },
  },
  {
    id: "hangboard-fingerboard",
    name: "Fingerboard / hangboard training",
    capacity: "grip_carry",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "extrapolated",
    sourceIds: [],
    guideId: "",
    quiet: true,
    why: "Quarantined: carries a documented finger-pulley injury rate and no verified beginner-safe primary guide was found.",
    quarantined: { reason: "No verified beginner-safe primary guide; injury-risk profile too specific to ship without one." },
  },
  {
    id: "static-stretch-prevention",
    name: "Static stretching for injury prevention",
    capacity: "mobility",
    environments: ["home-gym", "commercial-gym"],
    tier: "B",
    evidenceCertainty: "limited",
    sourceIds: [],
    guideId: "",
    quiet: true,
    why: "Quarantined: current evidence does not support static stretching preventing injury; shipping it under a prevention claim would overclaim.",
    quarantined: { reason: "The only available framing (injury prevention) is not supported by current evidence." },
  },
]

export function exerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}

export const SHIPPABLE_EXERCISES: Exercise[] = EXERCISES.filter((e) => !e.quarantined)
