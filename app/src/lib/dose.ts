/**
 * The dosage engine.
 *
 * Pure and deterministic: same profile + goal + environment + safety verdict
 * always produces the same prescription. Nothing here is guessed at runtime
 * or stored between sessions — it is a safe starting range, not a tracked
 * programme, and it says so.
 *
 * Every numeric floor/ceiling below is evidence-derived and cited; anything
 * marked "editorial" is an engineering judgement made to keep the ranges
 * usable, not a claim of its own.
 */

import type { CapacityId } from "../data/capacities.ts"
import { capacityById } from "../data/capacities.ts"
import { guideById } from "../data/evidence.ts"
import type { Exercise, MuscleId } from "../data/exercises.ts"
import type { FoundationSlot } from "./foundation.ts"
import type { GoalKind, TrainingAge } from "./goals.ts"
import type { Screen } from "./screening.ts"

/** ACSM 2026: floor per exercise and the weekly-per-muscle plateau. */
export const SETS_PER_EXERCISE_FLOOR = 2
export const WEEKLY_SETS_PER_MUSCLE_CAP = 20

const COMPOUND_CAPACITIES = new Set<CapacityId>([
  "knee_extension",
  "hip_hinge",
  "knee_flexion",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
])

export type ResistanceDose = {
  kind: "resistance"
  sets: number
  repsLow: number
  repsHigh: number
  restSeconds: [number, number]
  rir: [number, number]
  sessionsPerWeek: number
  progression: string
  sourceIds: string[]
  note?: string
}

export type AerobicDose = {
  kind: "aerobic"
  minutesPerWeek: [number, number]
  sessionsPerWeek: number
  progression: string
  sourceIds: string[]
  note?: string
}

export type IntervalDose = {
  kind: "interval"
  rounds: [number, number]
  workSeconds: [number, number]
  recovery: string
  sessionsPerWeek: number
  progression: string
  sourceIds: string[]
  note?: string
}

export type ReferralDose = {
  kind: "referral"
  note: string
  sourceIds: string[]
}

export type Dose = ResistanceDose | AerobicDose | IntervalDose | ReferralDose

export type SafetyDoseContext = {
  screenKind: Screen["kind"]
  age: number
}

const RIR_DEFAULT: [number, number] = [2, 3]
const RIR_CAUTION: [number, number] = [3, 4]

function repsForGoal(goal: GoalKind, compound: boolean): [number, number] {
  if (goal === "get-stronger") return compound ? [4, 6] : [8, 12]
  if (goal === "stay-healthy") return compound ? [10, 15] : [12, 15]
  if (goal === "lose-fat") return compound ? [8, 12] : [10, 15]
  // build-muscle
  return compound ? [6, 12] : [10, 15]
}

function setsForGoal(goal: GoalKind, compound: boolean, trainingAge: TrainingAge | undefined): number {
  if (goal === "stay-healthy") return SETS_PER_EXERCISE_FLOOR
  if (goal === "lose-fat") return compound ? 3 : SETS_PER_EXERCISE_FLOOR
  if (goal === "get-stronger") return compound ? 3 : SETS_PER_EXERCISE_FLOOR
  // build-muscle: training-age-scaled, per ACSM 2026 volume guards and the
  // Schoenfeld 2017 dose-response meta-analysis (~+0.37% hypertrophy per set,
  // trending up toward ~10 sets/week per muscle before plateauing). Combined
  // with sessionsPerWeekForGoal below, this is tuned so a single exercise's
  // weekly volume (sets x sessions/week) lands in a real hypertrophy working
  // range rather than the bare ACSM maintenance floor: ~6-8 sets/week for a
  // true beginner, ~10-14 for 1-3y trained, ~14-18 for 3+y trained -- all
  // still under WEEKLY_SETS_PER_MUSCLE_CAP so overlapping-capacity regions
  // (e.g. back) still get deduplicated rather than stacked further.
  const age = trainingAge ?? "none"
  if (age === "none" || age === "under-1") return compound ? 4 : 3
  if (age === "1-3") return 4
  return 4 // "3-plus"
}

function restForGoal(goal: GoalKind, compound: boolean): [number, number] {
  if (goal === "get-stronger" && compound) return [120, 180]
  return compound ? [90, 150] : [60, 90]
}

export function sessionsPerWeekForGoal(goal: GoalKind, trainingAge: TrainingAge | undefined): number {
  if (goal === "stay-healthy") return 2
  if (goal === "lose-fat") return 3
  if (goal === "get-stronger") return 3
  const age = trainingAge ?? "none"
  if (age === "none" || age === "under-1") return 2
  if (age === "1-3") return 3
  return 4
}

const PROGRESSION_TEXT =
  "Double progression: once you complete the top of the rep range on every set with clean technique and are still at this reps-in-reserve target for two sessions in a row, add the smallest safe load or a harder variation next time. If recovery or pain gets worse, repeat the same load or step back."

const HIGH_DOMS_NOTE =
  "This movement carries high delayed-onset soreness. Start with 1 set of 3-5 controlled reps for the first two weeks, then add a set every one to two weeks as soreness allows, before moving to the standard range."

/** The per-exercise "Your dose" prescription. */
export function doseForSlot(
  slot: FoundationSlot,
  goal: GoalKind,
  trainingAge: TrainingAge | undefined,
  safety: SafetyDoseContext,
): Dose {
  const exercise = slot.exercise
  const guide = guideById(exercise.guideId)

  if (guide?.role === "referral") {
    return { kind: "referral", note: exercise.why, sourceIds: exercise.sourceIds }
  }

  if (slot.capacity === "aerobic_base" || slot.capacity === "run_progression" || slot.capacity === "outdoors_loaded_carry_walk") {
    return aerobicDose(exercise, goal, safety)
  }

  if (slot.capacity === "run_strides" || slot.capacity === "boxing_conditioning") {
    return intervalDose(exercise, safety)
  }

  return resistanceDose(exercise, slot.capacity, goal, trainingAge, safety)
}

function resistanceDose(
  exercise: Exercise,
  capacity: CapacityId,
  goal: GoalKind,
  trainingAge: TrainingAge | undefined,
  safety: SafetyDoseContext,
): ResistanceDose {
  const compound = COMPOUND_CAPACITIES.has(capacity)
  const [repsLow, repsHigh] = repsForGoal(goal, compound)
  const [restLow, restHigh] = restForGoal(goal, compound)
  const sessionsPerWeek = sessionsPerWeekForGoal(goal, trainingAge)
  let sets = setsForGoal(goal, compound, trainingAge)
  let rir = RIR_DEFAULT
  let note: string | undefined

  if (safety.screenKind === "caution") {
    sets = Math.max(SETS_PER_EXERCISE_FLOOR, sets - 1)
    rir = RIR_CAUTION
    note = "Reduced from the standard starting point because your safety screening flagged something worth training around."
  }

  if (exercise.highDoms) {
    sets = 1
    note = note ? `${note} ${HIGH_DOMS_NOTE}` : HIGH_DOMS_NOTE
    return {
      kind: "resistance",
      sets,
      repsLow: 3,
      repsHigh: 6,
      restSeconds: [restLow, restHigh],
      rir,
      sessionsPerWeek: Math.min(sessionsPerWeek, 2),
      progression: PROGRESSION_TEXT,
      sourceIds: exercise.sourceIds,
      note,
    }
  }

  return {
    kind: "resistance",
    sets,
    repsLow,
    repsHigh,
    restSeconds: [restLow, restHigh],
    rir,
    sessionsPerWeek,
    progression: PROGRESSION_TEXT,
    sourceIds: exercise.sourceIds,
    note,
  }
}

function aerobicDose(exercise: Exercise, goal: GoalKind, safety: SafetyDoseContext): AerobicDose {
  // Guideline range is 150-300 min/week; entry dose is scaled conservatively
  // rather than starting a beginner at the guideline ceiling.
  let minutesPerWeek: [number, number] = [90, 150]
  if (goal === "lose-fat") minutesPerWeek = [120, 200]
  if (safety.screenKind === "caution") minutesPerWeek = [Math.round(minutesPerWeek[0] * 0.7), Math.round(minutesPerWeek[1] * 0.7)]

  return {
    kind: "aerobic",
    minutesPerWeek,
    sessionsPerWeek: 3,
    progression:
      "Add 10-15 minutes a week only once the current amount feels comfortably repeatable, working up toward the guideline range of 150-300 minutes a week over time.",
    sourceIds: exercise.sourceIds,
    note: goal === "lose-fat" ? "Aerobic work is added on top of your resistance sessions, not instead of them." : undefined,
  }
}

function intervalDose(exercise: Exercise, safety: SafetyDoseContext): IntervalDose {
  let rounds: [number, number] = [4, 6]
  if (safety.screenKind === "caution") rounds = [3, 4]
  return {
    kind: "interval",
    rounds,
    workSeconds: [20, 30],
    recovery: "Full recovery between efforts — this is about quality, not exhaustion.",
    sessionsPerWeek: 1,
    progression: "Add one round every one to two weeks once every effort still feels controlled, not once you can merely finish them.",
    sourceIds: exercise.sourceIds,
    note: exercise.prerequisite ? `Requires: ${exercise.prerequisite}.` : undefined,
  }
}

export type WeeklySummary = {
  strengthSessionsPerWeek: number
  totalWeeklySets: number
  aerobicMinutesPerWeek: [number, number] | null
  notes: string[]
}

/**
 * Deduplicates overlapping volume: sums weekly sets per anatomy region and
 * scales any region above WEEKLY_SETS_PER_MUSCLE_CAP back down, never below
 * SETS_PER_EXERCISE_FLOOR. This is what stops the same-looking region (e.g.
 * "back" fed by horizontal_pull, vertical_pull, scapular_cuff and grip_carry)
 * from silently stacking past the evidence-backed weekly ceiling.
 */
export function applyWeeklyVolumeCap(
  slots: FoundationSlot[],
  doses: Dose[],
): { doses: Dose[]; regionNotes: string[] } {
  const byRegion = new Map<MuscleId, { index: number; weekly: number }[]>()
  const out = [...doses]
  const regionNotes: string[] = []

  slots.forEach((slot, index) => {
    const dose = out[index]
    if (dose.kind !== "resistance") return
    const anatomy = capacityById(slot.capacity).anatomy
    if (!anatomy) return
    const weekly = dose.sets * dose.sessionsPerWeek
    const list = byRegion.get(anatomy) ?? []
    list.push({ index, weekly })
    byRegion.set(anatomy, list)
  })

  for (const [region, entries] of byRegion) {
    const total = entries.reduce((sum, e) => sum + e.weekly, 0)
    if (total <= WEEKLY_SETS_PER_MUSCLE_CAP) continue
    const scale = WEEKLY_SETS_PER_MUSCLE_CAP / total
    for (const { index } of entries) {
      const dose = out[index] as ResistanceDose
      const scaledSets = Math.max(SETS_PER_EXERCISE_FLOOR, Math.floor(dose.sets * scale))
      if (scaledSets === dose.sets) continue
      out[index] = {
        ...dose,
        sets: scaledSets,
        note: dose.note
          ? `${dose.note} Sets trimmed to keep total weekly ${region} volume within the evidence-backed range.`
          : `Sets trimmed to keep total weekly ${region} volume within the evidence-backed range.`,
      }
    }
    regionNotes.push(`${region}: weekly volume capped at ${WEEKLY_SETS_PER_MUSCLE_CAP} sets across overlapping exercises.`)
  }

  return { doses: out, regionNotes }
}

export function weeklySummary(slots: FoundationSlot[], doses: Dose[]): WeeklySummary {
  const resistanceSlots = slots.filter((_, i) => doses[i].kind === "resistance")
  const strengthSessionsPerWeek = resistanceSlots.length
    ? Math.max(...doses.filter((d): d is ResistanceDose => d.kind === "resistance").map((d) => d.sessionsPerWeek))
    : 0
  const totalWeeklySets = doses
    .filter((d): d is ResistanceDose => d.kind === "resistance")
    .reduce((sum, d) => sum + d.sets * d.sessionsPerWeek, 0)
  const aerobic = doses.find((d): d is AerobicDose => d.kind === "aerobic")
  return {
    strengthSessionsPerWeek,
    totalWeeklySets,
    aerobicMinutesPerWeek: aerobic ? aerobic.minutesPerWeek : null,
    notes: [
      "This is a safe starting range, not a guaranteed individual optimum — adjust within it as recovery and technique tell you to.",
    ],
  }
}
