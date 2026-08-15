/**
 * The weekly day-wise schedule.
 *
 * The dose engine owns sets, reps, rest, RIR and weekly volume. This module
 * only places that prescription onto named days. Full-body foundations keep
 * their existing per-session exposure; build-muscle foundations at 3+ days
 * use repeated split lanes so every anatomy region is trained on at least two
 * distinct days without changing its weekly set total.
 *
 * The floor is not editorial: it is the largest per-exercise weekly
 * frequency the dose engine has already prescribed (every full-body strength
 * exposure needs its own day), so asking for fewer days than the floor would
 * silently drop a prescribed exposure rather than just repackage it.
 */

import type { FoundationSlot } from "./foundation.ts"
import type { Dose, ResistanceDose, WeeklySummary } from "./dose.ts"
import type { GoalKind } from "./goals.ts"

export const SCHEDULE_SOURCE_IDS = [
  "who-2020-physical-activity",
  "acsm-2026-position-stand",
  "schoenfeld-2019-frequency-meta",
] as const

/** Editorial recovery/adherence margin: never schedule every day of the week, whatever the ceiling allows. */
const REST_DAY_MARGIN = 1
const MAX_TRAINING_DAYS = 7 - REST_DAY_MARGIN

/** WHO 2020: spread aerobic minutes across at least this many days rather than concentrating them. */
const AEROBIC_SPREAD_FLOOR = 3

/** Editorial engineering estimates used only to size a duration range, never presented as a trial finding. */
const SETUP_SECONDS_PER_EXERCISE = 60
const WARMUP_SECONDS = 300
const SECONDS_PER_REP = 3

export type DayBounds = {
  /** Cannot go lower without dropping a prescribed weekly exposure. */
  min: number
  /** The evidence-consistent default: the strength floor, spread wide enough for aerobic days when prescribed. */
  optimal: number
  /** Above this the same volume is just spread thinner; capped to keep at least one full rest day. */
  max: number
}

/** The floor/optimal/ceiling for how many days a week this plan can be run across. */
export function weeklyDayBounds(summary: WeeklySummary): DayBounds {
  const strengthDays = Math.max(summary.strengthSessionsPerWeek, 1)
  const min = strengthDays
  const wantsAerobicSpread = summary.aerobicMinutesPerWeek !== null
  const optimal = wantsAerobicSpread
    ? Math.min(Math.max(strengthDays, AEROBIC_SPREAD_FLOOR), MAX_TRAINING_DAYS)
    : Math.min(strengthDays, MAX_TRAINING_DAYS)
  const max = Math.min(Math.max(optimal, strengthDays + 2), MAX_TRAINING_DAYS)
  return { min: Math.min(min, max), optimal: Math.min(optimal, max), max }
}

/** Keeps a user-chosen day count inside the safe range without silently ignoring it. */
export function clampChosenDays(chosen: number, bounds: DayBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(chosen)))
}

/** `count` indices spread as evenly as possible across `total` slots, deterministic and collision-free. */
function evenlySpacedIndices(count: number, total: number): number[] {
  if (count <= 0 || total <= 0) return []
  const picked: number[] = []
  for (let i = 0; i < count; i++) {
    let pos = Math.round((i * total) / count) % total
    while (picked.includes(pos)) pos = (pos + 1) % total
    picked.push(pos)
  }
  return picked.sort((a, b) => a - b)
}

function subsetEvenly<T>(arr: T[], count: number): T[] {
  if (count >= arr.length) return arr
  return evenlySpacedIndices(count, arr.length).map((i) => arr[i])
}

/** 1-indexed day numbers (1-7) for the strength days and any extra aerobic-only days. */
function buildDayNumbers(chosenDays: number, strengthDays: number): { strength: number[]; aerobicOnly: number[] } {
  const strengthPositions = evenlySpacedIndices(strengthDays, 7)
  const remaining = Array.from({ length: 7 }, (_, i) => i).filter((d) => !strengthPositions.includes(d))
  const extra = Math.max(0, chosenDays - strengthDays)
  const aerobicPositions = subsetEvenly(remaining, Math.min(extra, remaining.length))
  return {
    strength: strengthPositions.map((d) => d + 1).sort((a, b) => a - b),
    aerobicOnly: [...aerobicPositions].map((d) => d + 1).sort((a, b) => a - b),
  }
}

function exerciseSecondsRange(dose: ResistanceDose): [number, number] {
  const workLow = dose.sets * dose.repsLow * SECONDS_PER_REP
  const workHigh = dose.sets * dose.repsHigh * SECONDS_PER_REP
  const restLow = dose.sets * dose.restSeconds[0]
  const restHigh = dose.sets * dose.restSeconds[1]
  return [workLow + restLow + SETUP_SECONDS_PER_EXERCISE, workHigh + restHigh + SETUP_SECONDS_PER_EXERCISE]
}

export type ScheduleDayKind = "strength" | "aerobic-only" | "rest"

export type SplitKind = "full-body" | "upper-lower" | "push-pull-legs"

export type ScheduleItem = {
  slotIndex: number
  exerciseId: string
  kind: Exclude<Dose["kind"], "referral">
  /** Sets performed on this day. In split mode this preserves the dose engine's exact weekly total. */
  scheduledSets?: number
  aerobicMinutes?: [number, number]
}

export type ScheduleDay = {
  /** 1-7, not tied to a calendar weekday: the reader places it on whichever real days fit their week. */
  dayNumber: number
  kind: ScheduleDayKind
  label: string
  items: ScheduleItem[]
  exerciseIds: string[]
  aerobicMinutes: [number, number]
  estimatedMinutes: [number, number]
}

export type WeeklySchedule = {
  chosenDays: number
  bounds: DayBounds
  split: SplitKind
  days: ScheduleDay[]
  sourceIds: readonly string[]
}

type SplitLane = "upper" | "lower" | "push" | "pull" | "legs" | "foundation"

const UPPER_CAPACITIES = new Set([
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "scapular_cuff",
  "grip_carry",
  "elbow_flexion",
  "elbow_extension",
  "calisthenics_push",
  "calisthenics_pull",
  "boxing_grip_forearm",
])

const LOWER_CAPACITIES = new Set([
  "knee_extension",
  "hip_hinge",
  "knee_flexion",
  "hip_ab_ad",
  "calf_soleus",
  "lumbar_extension",
  "run_hamstring_resilience",
  "calisthenics_squat",
])

const PUSH_CAPACITIES = new Set(["horizontal_push", "vertical_push", "elbow_extension", "calisthenics_push"])
const PULL_CAPACITIES = new Set([
  "horizontal_pull",
  "vertical_pull",
  "elbow_flexion",
  "grip_carry",
  "calisthenics_pull",
  "boxing_grip_forearm",
])
const LEG_CAPACITIES = new Set([
  "knee_extension",
  "hip_hinge",
  "knee_flexion",
  "hip_ab_ad",
  "calf_soleus",
  "lumbar_extension",
  "calisthenics_squat",
  "run_hamstring_resilience",
])

function splitKindFor(goal: GoalKind, strengthDays: number): SplitKind {
  if (goal !== "build-muscle" || strengthDays < 3) return "full-body"
  return strengthDays >= 6 ? "push-pull-legs" : "upper-lower"
}

function laneFor(slot: FoundationSlot, split: SplitKind): SplitLane {
  if (split === "upper-lower") {
    if (UPPER_CAPACITIES.has(slot.capacity)) return "upper"
    if (LOWER_CAPACITIES.has(slot.capacity)) return "lower"
    return "foundation"
  }
  if (PUSH_CAPACITIES.has(slot.capacity)) return "push"
  if (PULL_CAPACITIES.has(slot.capacity)) return "pull"
  if (LEG_CAPACITIES.has(slot.capacity)) return "legs"
  return "foundation"
}

function splitLabels(split: SplitKind, strengthDays: number): string[] {
  if (split === "upper-lower" && strengthDays === 3) return ["Upper", "Lower", "Full body"]
  if (split === "upper-lower") return ["Upper A", "Lower A", "Upper B", "Lower B"]
  if (split === "push-pull-legs") {
    return ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"]
  }
  return Array.from({ length: strengthDays }, () => "Full body")
}

function splitDayIndexes(lane: SplitLane, split: SplitKind, strengthDays: number): number[] {
  if (split === "upper-lower" && strengthDays === 3) {
    if (lane === "upper") return [0, 2]
    if (lane === "lower") return [1, 2]
    return [0, 1]
  }
  if (split === "upper-lower") {
    if (lane === "upper") return [0, 2]
    if (lane === "lower") return [1, 3]
    return [0, 3]
  }
  if (lane === "push") return [0, 3]
  if (lane === "pull") return [1, 4]
  if (lane === "legs") return [2, 5]
  return [0, 5]
}

function distributeSets(total: number, count: number): number[] {
  const base = Math.floor(total / count)
  const remainder = total % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

/**
 * Deterministic: the same slots/doses/goal/chosenDays always produce the same
 * week. Full-body plans preserve per-exercise frequency. Split plans repeat
 * each resistance capacity across two appropriate lanes and divide its exact
 * weekly set total between them. Aerobic minutes remain spread across days.
 */
export function buildWeeklySchedule(
  slots: FoundationSlot[],
  doses: Dose[],
  summary: WeeklySummary,
  chosenDaysInput: number,
  goal: GoalKind = "stay-healthy",
): WeeklySchedule {
  const bounds = weeklyDayBounds(summary)
  const chosenDays = clampChosenDays(chosenDaysInput, bounds)
  const strengthDays = Math.max(summary.strengthSessionsPerWeek, 1)
  const split = splitKindFor(goal, strengthDays)
  const { strength: strengthDayNumbers, aerobicOnly: aerobicOnlyDayNumbers } = buildDayNumbers(chosenDays, strengthDays)

  const dayContent = new Map<number, { label: string; items: ScheduleItem[]; seconds: [number, number] }>()
  const labels = splitLabels(split, strengthDays)
  strengthDayNumbers.forEach((d, index) => {
    dayContent.set(d, {
      label: labels[index] ?? "Full body",
      items: [],
      seconds: [WARMUP_SECONDS, WARMUP_SECONDS],
    })
  })
  for (const d of aerobicOnlyDayNumbers) dayContent.set(d, { label: "Aerobic", items: [], seconds: [0, 0] })

  slots.forEach((slot, i) => {
    const dose = doses[i]
    if (dose.kind !== "resistance") return
    if (split !== "full-body") {
      const lane = laneFor(slot, split)
      const assignedDays = splitDayIndexes(lane, split, strengthDays).map((index) => strengthDayNumbers[index])
      const setDistribution = distributeSets(dose.sets * dose.sessionsPerWeek, assignedDays.length)
      assignedDays.forEach((assignedDay, index) => {
        const entry = dayContent.get(assignedDay)
        if (!entry) return
        const scheduledSets = setDistribution[index]
        const [lo, hi] = exerciseSecondsRange({ ...dose, sets: scheduledSets })
        entry.items.push({ slotIndex: i, exerciseId: slot.exercise.id, kind: "resistance", scheduledSets })
        entry.seconds = [entry.seconds[0] + lo, entry.seconds[1] + hi]
      })
      return
    }
    const frequency = Math.max(1, Math.min(dose.sessionsPerWeek, strengthDayNumbers.length))
    const assignedDays = subsetEvenly(strengthDayNumbers, frequency)
    const [lo, hi] = exerciseSecondsRange(dose)
    for (const d of assignedDays) {
      const entry = dayContent.get(d)
      if (!entry) continue
      entry.items.push({ slotIndex: i, exerciseId: slot.exercise.id, kind: "resistance", scheduledSets: dose.sets })
      entry.seconds = [entry.seconds[0] + lo, entry.seconds[1] + hi]
    }
  })

  const allTrainingDays = [...strengthDayNumbers, ...aerobicOnlyDayNumbers].sort((a, b) => a - b)

  doses.forEach((dose, slotIndex) => {
    if (dose.kind === "aerobic") {
      const frequency = Math.max(1, Math.min(dose.sessionsPerWeek, allTrainingDays.length))
      const assignedDays = subsetEvenly(allTrainingDays, frequency)
      const minutes: [number, number] = [
        Math.round(dose.minutesPerWeek[0] / frequency),
        Math.round(dose.minutesPerWeek[1] / frequency),
      ]
      for (const dayNumber of assignedDays) {
        const entry = dayContent.get(dayNumber)
        if (!entry) continue
        entry.items.push({
          slotIndex,
          exerciseId: slots[slotIndex].exercise.id,
          kind: "aerobic",
          aerobicMinutes: minutes,
        })
      }
      return
    }
    if (dose.kind === "interval") {
      const frequency = Math.max(1, Math.min(dose.sessionsPerWeek, allTrainingDays.length))
      for (const dayNumber of subsetEvenly(allTrainingDays, frequency)) {
        const entry = dayContent.get(dayNumber)
        if (!entry) continue
        entry.items.push({ slotIndex, exerciseId: slots[slotIndex].exercise.id, kind: "interval" })
        entry.seconds = [
          entry.seconds[0] + dose.rounds[0] * dose.workSeconds[0],
          entry.seconds[1] + dose.rounds[1] * dose.workSeconds[1],
        ]
      }
    }
  })

  const days: ScheduleDay[] = []
  for (let dayNumber = 1; dayNumber <= 7; dayNumber++) {
    const entry = dayContent.get(dayNumber)
    if (!entry) {
      days.push({
        dayNumber,
        kind: "rest",
        label: "Rest",
        items: [],
        exerciseIds: [],
        aerobicMinutes: [0, 0],
        estimatedMinutes: [0, 0],
      })
      continue
    }
    const kind: ScheduleDayKind = strengthDayNumbers.includes(dayNumber) ? "strength" : "aerobic-only"
    const aerobicMinutes = entry.items.reduce<[number, number]>(
      (total, item) => [
        total[0] + (item.aerobicMinutes?.[0] ?? 0),
        total[1] + (item.aerobicMinutes?.[1] ?? 0),
      ],
      [0, 0],
    )
    const estimatedMinutes: [number, number] = [
      Math.round((entry.seconds[0] + aerobicMinutes[0] * 60) / 60),
      Math.round((entry.seconds[1] + aerobicMinutes[1] * 60) / 60),
    ]
    days.push({
      dayNumber,
      kind,
      label: entry.label,
      items: entry.items,
      exerciseIds: entry.items.filter((item) => item.kind === "resistance").map((item) => item.exerciseId),
      aerobicMinutes,
      estimatedMinutes,
    })
  }

  return { chosenDays, bounds, split, days, sourceIds: SCHEDULE_SOURCE_IDS }
}
