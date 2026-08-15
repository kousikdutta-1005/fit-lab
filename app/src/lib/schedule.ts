/**
 * The weekly day-wise schedule.
 *
 * Two things this module refuses to invent: it never changes how many sets
 * or how often an exercise is prescribed (that is `dose.ts`'s job, already
 * evidence-floored and ceilinged) and it never claims one specific number of
 * training days is uniquely correct. Instead it computes a safe range —
 * floor, a reasonable optimum, and ceiling — and lets the reader move inside
 * it, because frequency itself does not reliably change hypertrophy or
 * strength outcomes once weekly volume is held constant (Schoenfeld,
 * Grgic & Krieger 2019). What moving inside the range actually changes is
 * only how the same prescribed sessions and the same weekly aerobic minutes
 * are spread across the week.
 *
 * The floor is not editorial: it is the largest per-exercise weekly
 * frequency the dose engine has already prescribed (every full-body strength
 * exposure needs its own day), so asking for fewer days than the floor would
 * silently drop a prescribed exposure rather than just repackage it.
 */

import type { FoundationSlot } from "./foundation.ts"
import type { Dose, ResistanceDose, WeeklySummary } from "./dose.ts"

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

export type ScheduleDay = {
  /** 1-7, not tied to a calendar weekday: the reader places it on whichever real days fit their week. */
  dayNumber: number
  kind: ScheduleDayKind
  exerciseIds: string[]
  aerobicMinutes: [number, number]
  estimatedMinutes: [number, number]
}

export type WeeklySchedule = {
  chosenDays: number
  bounds: DayBounds
  days: ScheduleDay[]
  sourceIds: readonly string[]
}

/**
 * Deterministic: the same slots/doses/chosenDays always produce the same
 * week. Every full-body strength exposure the dose engine prescribed keeps
 * its own frequency (a high-DOMS exercise capped at 2x/week still only
 * appears on 2 of the strength days, evenly spaced); only the total number
 * of training days and how aerobic minutes are spread across them move.
 */
export function buildWeeklySchedule(
  slots: FoundationSlot[],
  doses: Dose[],
  summary: WeeklySummary,
  chosenDaysInput: number,
): WeeklySchedule {
  const bounds = weeklyDayBounds(summary)
  const chosenDays = clampChosenDays(chosenDaysInput, bounds)
  const strengthDays = Math.max(summary.strengthSessionsPerWeek, 1)
  const { strength: strengthDayNumbers, aerobicOnly: aerobicOnlyDayNumbers } = buildDayNumbers(chosenDays, strengthDays)

  const dayContent = new Map<number, { exerciseIds: string[]; seconds: [number, number] }>()
  for (const d of strengthDayNumbers) dayContent.set(d, { exerciseIds: [], seconds: [WARMUP_SECONDS, WARMUP_SECONDS] })
  for (const d of aerobicOnlyDayNumbers) dayContent.set(d, { exerciseIds: [], seconds: [0, 0] })

  slots.forEach((slot, i) => {
    const dose = doses[i]
    if (dose.kind !== "resistance") return
    const frequency = Math.max(1, Math.min(dose.sessionsPerWeek, strengthDayNumbers.length))
    const assignedDays = subsetEvenly(strengthDayNumbers, frequency)
    const [lo, hi] = exerciseSecondsRange(dose)
    for (const d of assignedDays) {
      const entry = dayContent.get(d)
      if (!entry) continue
      entry.exerciseIds.push(slot.exercise.id)
      entry.seconds = [entry.seconds[0] + lo, entry.seconds[1] + hi]
    }
  })

  const allTrainingDays = [...strengthDayNumbers, ...aerobicOnlyDayNumbers].sort((a, b) => a - b)
  const [aerobicLowTotal, aerobicHighTotal] = summary.aerobicMinutesPerWeek ?? [0, 0]
  const perDayAerobicLow = allTrainingDays.length ? Math.round(aerobicLowTotal / allTrainingDays.length) : 0
  const perDayAerobicHigh = allTrainingDays.length ? Math.round(aerobicHighTotal / allTrainingDays.length) : 0

  const days: ScheduleDay[] = []
  for (let dayNumber = 1; dayNumber <= 7; dayNumber++) {
    const entry = dayContent.get(dayNumber)
    if (!entry) {
      days.push({ dayNumber, kind: "rest", exerciseIds: [], aerobicMinutes: [0, 0], estimatedMinutes: [0, 0] })
      continue
    }
    const kind: ScheduleDayKind = strengthDayNumbers.includes(dayNumber) ? "strength" : "aerobic-only"
    const aerobicMinutes: [number, number] = [perDayAerobicLow, perDayAerobicHigh]
    const estimatedMinutes: [number, number] = [
      Math.round((entry.seconds[0] + aerobicMinutes[0] * 60) / 60),
      Math.round((entry.seconds[1] + aerobicMinutes[1] * 60) / 60),
    ]
    days.push({ dayNumber, kind, exerciseIds: entry.exerciseIds, aerobicMinutes, estimatedMinutes })
  }

  return { chosenDays, bounds, days, sourceIds: SCHEDULE_SOURCE_IDS }
}
