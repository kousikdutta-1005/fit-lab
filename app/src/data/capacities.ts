import type { MuscleId } from "./exercises.ts"

/**
 * The capacity taxonomy.
 *
 * A "capacity" is a movement/physiological demand the foundation must cover
 * (squat pattern, hinge pattern, aerobic base...). It replaces "pick a muscle
 * group" with "cover a movement demand", which is what the evidence actually
 * supports selecting for. Multiple capacities can map to the same visible
 * anatomy group (e.g. hip_hinge and hip_ab_ad both render on "glutes"); some
 * capacities are abstract and render no anatomy at all (aerobic_base,
 * balance) — per product rule, abstract capacities are never forced onto a
 * mesh region they don't belong to.
 */
export type CapacityId =
  | "aerobic_base"
  | "knee_extension"
  | "hip_hinge"
  | "knee_flexion"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "hip_ab_ad"
  | "calf_soleus"
  | "scapular_cuff"
  | "grip_carry"
  | "trunk_control"
  | "elbow_flexion"
  | "elbow_extension"
  | "lumbar_extension"
  | "balance"
  | "mobility"
  // conditional, age/safety-gated only
  | "floor_transfer"
  // optional, emphasis-gated only
  | "run_progression"
  | "run_hamstring_resilience"
  | "run_strides"
  | "boxing_grip_forearm"
  | "boxing_conditioning"
  | "outdoors_loaded_carry_walk"
  | "outdoors_trip_prep"
  | "outdoors_stair_intervals"
  | "yoga_session"
  | "calisthenics_push"
  | "calisthenics_pull"
  | "calisthenics_squat"
  // optional, always defined for honesty even though currently quarantined
  // (no verified credentialed primary guide found — see exercises.ts)
  | "neck_isometric"
  | "dorsiflexion"

export type CapacityGroup = "required" | "conditional" | "optional"

export type Capacity = {
  id: CapacityId
  label: string
  plain: string
  /** null = abstract; renders no anatomy highlight. */
  anatomy: MuscleId | null
  group: CapacityGroup
}

export const CAPACITIES: Capacity[] = [
  { id: "aerobic_base", label: "Aerobic base", plain: "Steady, easy-to-hold cardio", anatomy: null, group: "required" },
  { id: "knee_extension", label: "Knee extension", plain: "Squat pattern", anatomy: "quads", group: "required" },
  { id: "hip_hinge", label: "Hip hinge", plain: "Deadlift/bridge pattern", anatomy: "glutes", group: "required" },
  { id: "knee_flexion", label: "Knee flexion", plain: "Hamstring curl pattern", anatomy: "hamstrings", group: "required" },
  { id: "horizontal_push", label: "Horizontal push", plain: "Press-away pattern", anatomy: "chest", group: "required" },
  { id: "vertical_push", label: "Vertical push", plain: "Overhead press pattern", anatomy: "shoulders", group: "required" },
  { id: "horizontal_pull", label: "Horizontal pull", plain: "Row pattern", anatomy: "back", group: "required" },
  { id: "vertical_pull", label: "Vertical pull", plain: "Pulldown/pull-up pattern", anatomy: "back", group: "required" },
  { id: "hip_ab_ad", label: "Hip ab/adduction", plain: "Side-to-side hip strength", anatomy: "glutes", group: "required" },
  { id: "calf_soleus", label: "Calf & soleus", plain: "Lower-leg strength", anatomy: "calves", group: "required" },
  { id: "scapular_cuff", label: "Scapular & cuff", plain: "Shoulder-blade control", anatomy: "shoulders", group: "required" },
  { id: "grip_carry", label: "Grip & carry", plain: "Carrying load", anatomy: "back", group: "required" },
  { id: "trunk_control", label: "Trunk control", plain: "Core anti-rotation/anti-extension", anatomy: "core", group: "required" },
  { id: "elbow_flexion", label: "Elbow flexion", plain: "Biceps curl pattern", anatomy: "biceps", group: "required" },
  { id: "elbow_extension", label: "Elbow extension", plain: "Triceps extension pattern", anatomy: "triceps", group: "required" },
  { id: "lumbar_extension", label: "Lumbar extension", plain: "Controlled low-back extension (good-morning pattern)", anatomy: "back", group: "required" },
  { id: "balance", label: "Balance", plain: "Standing balance work", anatomy: null, group: "conditional" },
  { id: "mobility", label: "Mobility", plain: "Everyday joint range", anatomy: null, group: "conditional" },
  {
    id: "floor_transfer",
    label: "Floor transfer",
    plain: "Sit-to-stand / getting up off the floor",
    anatomy: null,
    group: "conditional",
  },
  { id: "run_progression", label: "Running progression", plain: "Structured run-building", anatomy: null, group: "optional" },
  { id: "run_hamstring_resilience", label: "Hamstring resilience", plain: "Running-specific hamstring work", anatomy: "hamstrings", group: "optional" },
  { id: "run_strides", label: "Strides", plain: "Short fast efforts, gated on a base", anatomy: null, group: "optional" },
  { id: "boxing_grip_forearm", label: "Grip & forearm", plain: "Wrist/forearm resilience", anatomy: null, group: "optional" },
  { id: "boxing_conditioning", label: "Conditioning intervals", plain: "Short, hard conditioning bouts", anatomy: null, group: "optional" },
  { id: "outdoors_loaded_carry_walk", label: "Loaded carry/walk", plain: "Rucking-style loaded walking", anatomy: null, group: "optional" },
  {
    id: "outdoors_trip_prep",
    label: "Trip preparation & safety referrals",
    plain: "What to plan and pack, plus climbing-landing/water-safety referrals — not a muscle",
    anatomy: null,
    group: "optional",
  },
  { id: "outdoors_stair_intervals", label: "Stair intervals", plain: "Short stepping-pace intervals on stairs/steps", anatomy: null, group: "optional" },
  { id: "yoga_session", label: "Beginner yoga session", plain: "A guided mobility/balance/breath session", anatomy: null, group: "optional" },
  { id: "calisthenics_push", label: "Bodyweight push progression", plain: "Push-up progression ladder", anatomy: "chest", group: "optional" },
  { id: "calisthenics_pull", label: "Bodyweight pull progression", plain: "Pull-up progression ladder", anatomy: "back", group: "optional" },
  { id: "calisthenics_squat", label: "Bodyweight squat progression", plain: "Pistol-squat progression ladder", anatomy: "quads", group: "optional" },
  {
    id: "neck_isometric",
    label: "Neck isometrics",
    plain: "Gentle isometric neck strength work",
    anatomy: null,
    group: "optional",
  },
  {
    id: "dorsiflexion",
    label: "Dorsiflexion / tibialis",
    plain: "Toe-clearance / shin strength work",
    anatomy: null,
    group: "optional",
  },
]

export function capacityById(id: CapacityId): Capacity {
  const c = CAPACITIES.find((x) => x.id === id)
  if (!c) throw new Error(`Unknown capacity id: ${id}`)
  return c
}

export const REQUIRED_CAPACITIES: CapacityId[] = CAPACITIES.filter((c) => c.group === "required").map((c) => c.id)

/**
 * The optional post-result one-tap emphasis. Each changes at most three
 * slots; the untouched default stays foundation-only and infers nothing.
 */
export type Emphasis = "general" | "running" | "boxing" | "outdoors" | "yoga" | "calisthenics"

export const EMPHASES: { id: Emphasis; label: string; plain: string }[] = [
  { id: "general", label: "General", plain: "The foundation only. No extra inference." },
  { id: "running", label: "Running", plain: "Adds a structured run progression and running-specific hamstring work." },
  { id: "boxing", label: "Boxing", plain: "Adds optional grip/forearm and conditioning-interval work, explicitly extrapolated from combat-sport training." },
  { id: "outdoors", label: "Climbing & outdoors", plain: "Adds loaded carry/walk, stair intervals and trip-preparation, with safety referrals only." },
  { id: "yoga", label: "Yoga", plain: "Adds a beginner guided session plus extra mobility/balance — useful, not a unique mechanism, and not a substitute for the resistance/aerobic dose." },
  { id: "calisthenics", label: "Calisthenics", plain: "Adds bodyweight progression ladders for push/pull/squat alongside the standard picks — same movement patterns, no new equipment." },
]

/** At most this many foundation slots may be added/reordered per emphasis. */
export const EMPHASIS_SLOT_CAP = 3
