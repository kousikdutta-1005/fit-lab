/**
 * Temporary exercise catalogue.
 *
 * The public dataset this started from (yuhonas/free-exercise-db, public domain)
 * has 873 exercises, but only 131 of them need no equipment, glutes have 22
 * entries against 148 for quads, and nothing in it knows what a 700 square foot
 * flat with a family in it is like. So this is hand-built instead.
 *
 * This legacy catalogue remains only so the structural full-body flow has
 * variants to display. The evidence layer that follows this change will replace
 * and verify the catalogue; this file is not the final prescription.
 */

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

export type Equipment = "none" | "band" | "bar" | "dumbbell" | "barbell" | "machine" | "bench"

export type Exercise = {
  id: string
  name: string
  muscle: MuscleId
  equipment: Equipment
  /** Safe in a flat with neighbours below and family in the next room. */
  quiet: boolean
  /** Loads the muscle in a stretched position, where the evidence is strongest. */
  lengthened: boolean
  /** How easily you can keep adding difficulty over months. */
  overload: "easy" | "workable" | "hard"
  /** The criterion this exercise actually wins on, shown to the reader. */
  why: string
}

export const EXERCISES: Exercise[] = [
  // Chest
  { id: "pushup", name: "Push-up", muscle: "chest", equipment: "none", quiet: true, lengthened: false, overload: "workable", why: "Costs nothing, needs a floor, and scales for years by slowing the descent and raising your feet." },
  { id: "feet-elevated-pushup", name: "Feet-elevated push-up", muscle: "chest", equipment: "none", quiet: true, lengthened: false, overload: "workable", why: "The honest next step once ordinary push-ups stop being hard. A bed or chair is enough." },
  { id: "deficit-pushup", name: "Push-up on books or a low stool", muscle: "chest", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "Letting your chest drop below your hands loads it in the stretched position, where the growth evidence is strongest." },
  { id: "band-press", name: "Band chest press", muscle: "chest", equipment: "band", quiet: true, lengthened: false, overload: "easy", why: "A band around your back turns a push into something you can add resistance to a step at a time." },
  { id: "db-bench", name: "Dumbbell bench press", muscle: "chest", equipment: "dumbbell", quiet: true, lengthened: true, overload: "easy", why: "Deeper stretch than a barbell and each side has to carry itself." },
  { id: "incline-db", name: "Incline dumbbell press", muscle: "chest", equipment: "dumbbell", quiet: true, lengthened: true, overload: "easy", why: "Covers the upper chest, which push-ups tend to under-serve." },

  // Back
  { id: "table-row", name: "Row under a sturdy table", muscle: "back", equipment: "none", quiet: true, lengthened: true, overload: "hard", why: "The one real answer for backs at home with nothing. Lie under a table, grip the edge, pull your chest to it." },
  { id: "band-row", name: "Band row", muscle: "back", equipment: "band", quiet: true, lengthened: true, overload: "easy", why: "A band anchored to a door handle solves the hardest gap in home training for roughly the price of a meal." },
  { id: "band-pulldown", name: "Band pulldown", muscle: "back", equipment: "band", quiet: true, lengthened: true, overload: "easy", why: "The vertical pull your back needs when no bar exists to hang from." },
  { id: "pullup", name: "Pull-up", muscle: "back", equipment: "bar", quiet: true, lengthened: true, overload: "workable", why: "Still the best thing you can do for a back, if you have anything solid to hang from." },
  { id: "db-row", name: "One-arm dumbbell row", muscle: "back", equipment: "dumbbell", quiet: true, lengthened: true, overload: "easy", why: "Easy to load, easy to learn, and hard to cheat badly enough to hurt yourself." },
  { id: "lat-pulldown", name: "Lat pulldown", muscle: "back", equipment: "machine", quiet: true, lengthened: true, overload: "easy", why: "Adjustable in small steps, which matters when you cannot yet pull your own bodyweight." },

  // Shoulders
  { id: "pike-pushup", name: "Pike push-up", muscle: "shoulders", equipment: "none", quiet: true, lengthened: false, overload: "workable", why: "Turns a push-up into an overhead press using only your hips." },
  { id: "band-lateral", name: "Band lateral raise", muscle: "shoulders", equipment: "band", quiet: true, lengthened: false, overload: "easy", why: "The side of the shoulder is nearly untrainable with bodyweight alone. A band fixes it." },
  { id: "db-press", name: "Dumbbell overhead press", muscle: "shoulders", equipment: "dumbbell", quiet: true, lengthened: false, overload: "easy", why: "The straightforward way to load a shoulder overhead without a rack." },
  { id: "db-lateral", name: "Dumbbell lateral raise", muscle: "shoulders", equipment: "dumbbell", quiet: true, lengthened: false, overload: "easy", why: "The side delt does one job and this is it. Light weight, high reps, no swinging." },

  // Biceps
  { id: "band-curl", name: "Band curl", muscle: "biceps", equipment: "band", quiet: true, lengthened: false, overload: "easy", why: "Biceps genuinely cannot be trained well with nothing at all. This is the cheapest honest answer." },
  { id: "towel-curl", name: "Towel curl against your own arm", muscle: "biceps", equipment: "none", quiet: true, lengthened: false, overload: "hard", why: "Better than nothing and worse than a band. We would rather say that than pretend otherwise." },
  { id: "db-curl", name: "Dumbbell curl", muscle: "biceps", equipment: "dumbbell", quiet: true, lengthened: false, overload: "easy", why: "Simple, and easy to add half a kilo to." },
  { id: "incline-curl", name: "Incline dumbbell curl", muscle: "biceps", equipment: "bench", quiet: true, lengthened: true, overload: "easy", why: "Arm behind the body puts the biceps on stretch, which is where the recent evidence favours." },

  // Triceps
  { id: "close-pushup", name: "Close-grip push-up", muscle: "triceps", equipment: "none", quiet: true, lengthened: false, overload: "workable", why: "Hands under your chest shifts the work from chest to triceps. No equipment, no noise." },
  { id: "bench-dip", name: "Bench dip", muscle: "triceps", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "A chair and the floor. Loads the triceps at length at the bottom." },
  { id: "overhead-ext", name: "Overhead extension", muscle: "triceps", equipment: "dumbbell", quiet: true, lengthened: true, overload: "easy", why: "The long head of the triceps only stretches when the arm is overhead. Nothing else reaches it." },

  // Quads
  { id: "squat", name: "Bodyweight squat", muscle: "quads", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "Free, silent, and the movement everything else builds on." },
  { id: "split-squat", name: "Bulgarian split squat", muscle: "quads", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "One leg carrying your whole bodyweight is genuinely hard training with no equipment at all." },
  { id: "goblet", name: "Goblet squat", muscle: "quads", equipment: "dumbbell", quiet: true, lengthened: true, overload: "easy", why: "Holding the weight in front keeps your torso upright, which makes it easier to learn than a barbell." },
  { id: "back-squat", name: "Barbell back squat", muscle: "quads", equipment: "barbell", quiet: true, lengthened: true, overload: "easy", why: "Loads more than anything else and adds up in the smallest increments over years." },

  // Hamstrings
  { id: "nordic", name: "Assisted Nordic curl", muscle: "hamstrings", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "Hook your feet under a bed. One of the few genuinely hard hamstring exercises needing nothing." },
  { id: "single-rdl", name: "Single-leg Romanian deadlift", muscle: "hamstrings", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "Trains the hamstring at long length and your balance at the same time." },
  { id: "rdl", name: "Romanian deadlift", muscle: "hamstrings", equipment: "barbell", quiet: true, lengthened: true, overload: "easy", why: "The strongest stretch a hamstring gets under load." },

  // Glutes
  { id: "glute-bridge", name: "Glute bridge", muscle: "glutes", equipment: "none", quiet: true, lengthened: false, overload: "workable", why: "Floor, no noise, no equipment, and it works from the first session." },
  { id: "single-bridge", name: "Single-leg glute bridge", muscle: "glutes", equipment: "none", quiet: true, lengthened: false, overload: "workable", why: "Doubles the load without adding any weight." },
  { id: "hip-thrust", name: "Hip thrust", muscle: "glutes", equipment: "bench", quiet: true, lengthened: false, overload: "easy", why: "Back on a sofa or bed edge, and the glutes take load nothing else gives them." },
  { id: "step-up", name: "Step-up", muscle: "glutes", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "A sturdy chair. Loads the glute at length on the way up." },

  // Calves
  { id: "calf-raise", name: "Standing calf raise on a step", muscle: "calves", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "Heels hanging off a step gives the stretch that a flat floor does not." },
  { id: "single-calf", name: "Single-leg calf raise", muscle: "calves", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "The simplest way to keep making calves harder without any weight." },

  // Core
  { id: "plank", name: "Plank", muscle: "core", equipment: "none", quiet: true, lengthened: false, overload: "hard", why: "Good for learning to brace. Stops being useful once you can hold it a long time." },
  { id: "dead-bug", name: "Dead bug", muscle: "core", equipment: "none", quiet: true, lengthened: false, overload: "workable", why: "Trains the core to resist movement, which is what it does in real life, and it is kind to backs." },
  { id: "leg-raise", name: "Lying leg raise", muscle: "core", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "Reaches the lower abdominals, and needs only a floor." },
  { id: "ab-wheel", name: "Ab wheel rollout", muscle: "core", equipment: "none", quiet: true, lengthened: true, overload: "workable", why: "The hardest thing you can do to a core at home, and the wheel costs very little." },
]

export type Place = "home-gym" | "commercial-gym"

const HOME_GYM_EQUIPMENT: Equipment[] = ["none", "band", "bar", "dumbbell", "bench"]
const ALL_EQUIPMENT: Equipment[] = ["none", "band", "bar", "dumbbell", "barbell", "machine", "bench"]

export function equipmentFor(place: Place): Equipment[] {
  return place === "home-gym" ? [...HOME_GYM_EQUIPMENT] : [...ALL_EQUIPMENT]
}

export function pickExercises(muscle: MuscleId, place: Place, limit = 3): Exercise[] {
  const allowed = equipmentFor(place)
  const pool = EXERCISES.filter((e) => e.muscle === muscle && allowed.includes(e.equipment))
  const score = (e: Exercise) =>
    (e.lengthened ? 2 : 0) +
    (e.overload === "easy" ? 2 : e.overload === "workable" ? 1 : 0) +
    (e.quiet ? 1 : 0)
  return [...pool].sort((a, b) => score(b) - score(a)).slice(0, limit)
}

export type FoundationGroup = {
  muscle: (typeof MUSCLES)[number]
  exercises: Exercise[]
}

/**
 * Every current muscle group appears once. The environment changes the
 * available variants, never the coverage.
 */
export function fullBodyFoundation(place: Place, limit = 3): FoundationGroup[] {
  return MUSCLES.map((muscle) => ({
    muscle,
    exercises: pickExercises(muscle.id, place, limit),
  }))
}

/**
 * The home-gym definition stays explicit while the evidence layer determines
 * the rest of the minimum kit. A commercial gym needs no environment note.
 */
export function gapFor(place: Place): string | null {
  return place === "home-gym"
    ? "Home gym currently means at least adjustable dumbbells, elastic bands with a safe anchor, a bench, and a safe pull-up solution. The next evidence layer will define any remaining essential kit before this becomes the final catalogue."
    : null
}
