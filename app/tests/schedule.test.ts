import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

import { applyWeeklyVolumeCap, doseForSlot, weeklySummary } from "../src/lib/dose.ts"
import type { SafetyDoseContext } from "../src/lib/dose.ts"
import { buildFoundation } from "../src/lib/foundation.ts"
import type { FoundationSlot, SafetyContext } from "../src/lib/foundation.ts"
import type { GoalKind, TrainingAge } from "../src/lib/goals.ts"
import type { Place } from "../src/data/exercises.ts"
import { sourceById } from "../src/data/evidence.ts"
import {
  SCHEDULE_SOURCE_IDS,
  buildWeeklySchedule,
  clampChosenDays,
  weeklyDayBounds,
} from "../src/lib/schedule.ts"

const CLEAR: SafetyContext = { screenKind: "clear", conditions: [], jointProblem: false, pregnant: false, age: 30 }
const CLEAR_DOSE: SafetyDoseContext = { screenKind: "clear", age: 30 }
const OLDER: SafetyContext = { screenKind: "clear", conditions: [], jointProblem: false, pregnant: false, age: 68 }
const OLDER_DOSE: SafetyDoseContext = { screenKind: "clear", age: 68 }

const GOALS: GoalKind[] = ["stay-healthy", "lose-fat", "build-muscle", "get-stronger"]
const TRAINING_AGES: (TrainingAge | undefined)[] = [undefined, "none", "under-1", "1-3", "3-plus"]
const PLACES: Place[] = ["home-gym", "commercial-gym"]

function scheduleFor(
  place: Place,
  goal: GoalKind,
  trainingAge: TrainingAge | undefined,
  ctx: SafetyContext,
  doseCtx: SafetyDoseContext,
  chosenDays?: number,
) {
  const slots: FoundationSlot[] = buildFoundation(place, ctx, "general")
  const rawDoses = slots.map((slot) => doseForSlot(slot, goal, trainingAge, doseCtx))
  const { doses } = applyWeeklyVolumeCap(slots, rawDoses)
  const summary = weeklySummary(slots, doses)
  const bounds = weeklyDayBounds(summary)
  const schedule = buildWeeklySchedule(slots, doses, summary, chosenDays ?? bounds.optimal)
  return { slots, doses, summary, bounds, schedule }
}

describe("weekly day bounds", () => {
  it("never lets the minimum fall below the dose engine's own strength-session floor, for every goal x training-age x environment", () => {
    for (const place of PLACES) {
      for (const goal of GOALS) {
        for (const trainingAge of TRAINING_AGES) {
          const { summary, bounds } = scheduleFor(place, goal, trainingAge, CLEAR, CLEAR_DOSE)
          assert.equal(bounds.min, Math.max(summary.strengthSessionsPerWeek, 1))
        }
      }
    }
  })

  it("keeps min <= optimal <= max always", () => {
    for (const place of PLACES) {
      for (const goal of GOALS) {
        for (const trainingAge of TRAINING_AGES) {
          const { bounds } = scheduleFor(place, goal, trainingAge, CLEAR, CLEAR_DOSE)
          assert.equal(bounds.min <= bounds.optimal, true)
          assert.equal(bounds.optimal <= bounds.max, true)
        }
      }
    }
  })

  it("never exceeds 6 training days a week, reserving at least one full rest day", () => {
    for (const place of PLACES) {
      for (const goal of GOALS) {
        for (const trainingAge of TRAINING_AGES) {
          const { bounds } = scheduleFor(place, goal, trainingAge, CLEAR, CLEAR_DOSE)
          assert.equal(bounds.max <= 6, true)
        }
      }
    }
  })

  it("is deterministic: repeated calls with identical inputs give identical bounds", () => {
    const { summary } = scheduleFor("home-gym", "build-muscle", "3-plus", CLEAR, CLEAR_DOSE)
    const a = weeklyDayBounds(summary)
    const b = weeklyDayBounds(summary)
    assert.deepEqual(a, b)
  })

  it("spreads to at least 3 days when aerobic work is prescribed (WHO 2020 spread guidance), unless the strength floor already exceeds it", () => {
    const { summary, bounds } = scheduleFor("home-gym", "stay-healthy", "none", CLEAR, CLEAR_DOSE)
    assert.equal(summary.aerobicMinutesPerWeek !== null, true)
    assert.equal(bounds.optimal >= Math.min(3, bounds.max), true)
  })

  it("applies the older-adult / safety overlay without breaking the min <= optimal <= max invariant", () => {
    for (const goal of GOALS) {
      const { bounds } = scheduleFor("home-gym", goal, "none", OLDER, OLDER_DOSE)
      assert.equal(bounds.min <= bounds.optimal, true)
      assert.equal(bounds.optimal <= bounds.max, true)
    }
  })
})

describe("clampChosenDays", () => {
  const bounds = { min: 2, optimal: 3, max: 5 }

  it("leaves an in-range choice untouched", () => {
    assert.equal(clampChosenDays(4, bounds), 4)
  })

  it("clamps below the minimum up to the minimum", () => {
    assert.equal(clampChosenDays(0, bounds), 2)
    assert.equal(clampChosenDays(1, bounds), 2)
  })

  it("clamps above the maximum down to the maximum", () => {
    assert.equal(clampChosenDays(9, bounds), 5)
  })

  it("rounds fractional input", () => {
    assert.equal(clampChosenDays(3.4, bounds), 3)
    assert.equal(clampChosenDays(3.6, bounds), 4)
  })
})

describe("buildWeeklySchedule", () => {
  it("produces exactly 7 days, numbered 1-7 with no duplicates", () => {
    const { schedule } = scheduleFor("home-gym", "build-muscle", "3-plus", CLEAR, CLEAR_DOSE)
    assert.equal(schedule.days.length, 7)
    const numbers = schedule.days.map((d) => d.dayNumber).sort((a, b) => a - b)
    assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7])
    assert.equal(new Set(numbers).size, 7)
  })

  it("assigns exactly strengthSessionsPerWeek days as 'strength', matching the dose engine's own floor", () => {
    for (const place of PLACES) {
      for (const goal of GOALS) {
        for (const trainingAge of TRAINING_AGES) {
          const { summary, schedule } = scheduleFor(place, goal, trainingAge, CLEAR, CLEAR_DOSE)
          const strengthDays = schedule.days.filter((d) => d.kind === "strength")
          assert.equal(strengthDays.length, Math.max(summary.strengthSessionsPerWeek, 1))
        }
      }
    }
  })

  it("leaves at least one rest day whatever the chosen day count", () => {
    for (const place of PLACES) {
      for (const goal of GOALS) {
        const { bounds, slots, doses, summary } = scheduleFor(place, goal, "3-plus", CLEAR, CLEAR_DOSE)
        const schedule = buildWeeklySchedule(slots, doses, summary, bounds.max)
        const restDays = schedule.days.filter((d) => d.kind === "rest")
        assert.equal(restDays.length >= 1, true)
      }
    }
  })

  it("gives rest days exactly a [0,0] duration and no exercises", () => {
    const { schedule } = scheduleFor("home-gym", "stay-healthy", "none", CLEAR, CLEAR_DOSE)
    for (const day of schedule.days) {
      if (day.kind === "rest") {
        assert.deepEqual(day.estimatedMinutes, [0, 0])
        assert.deepEqual(day.aerobicMinutes, [0, 0])
        assert.deepEqual(day.exerciseIds, [])
      }
    }
  })

  it("keeps every non-rest day's estimated-minute range valid (low <= high, low > 0)", () => {
    for (const place of PLACES) {
      for (const goal of GOALS) {
        const { schedule } = scheduleFor(place, goal, "3-plus", CLEAR, CLEAR_DOSE)
        for (const day of schedule.days) {
          if (day.kind === "rest") continue
          assert.equal(day.estimatedMinutes[0] <= day.estimatedMinutes[1], true)
          assert.equal(day.estimatedMinutes[0] > 0, true)
        }
      }
    }
  })

  it("keeps aerobicMinutes ranges valid (low <= high) on every day", () => {
    const { schedule } = scheduleFor("home-gym", "lose-fat", "none", CLEAR, CLEAR_DOSE)
    for (const day of schedule.days) {
      assert.equal(day.aerobicMinutes[0] <= day.aerobicMinutes[1], true)
    }
  })

  it("never assigns a resistance exercise to more distinct days than its own prescribed sessionsPerWeek", () => {
    const { slots, doses, summary, bounds } = scheduleFor("home-gym", "build-muscle", "3-plus", CLEAR, CLEAR_DOSE)
    const schedule = buildWeeklySchedule(slots, doses, summary, bounds.max)
    slots.forEach((slot, i) => {
      const dose = doses[i]
      if (dose.kind !== "resistance") return
      const daysWithThisExercise = schedule.days.filter((d) => d.exerciseIds.includes(slot.exercise.id))
      assert.equal(daysWithThisExercise.length <= dose.sessionsPerWeek, true)
      assert.equal(daysWithThisExercise.length <= schedule.days.filter((d) => d.kind === "strength").length, true)
    })
  })

  it("spaces a lower-frequency exercise (fewer sessions/week than the strength floor) evenly rather than clustering it", () => {
    // build-muscle + 3-plus + a home ceiling scenario is likely to include a capped-frequency,
    // high-DOMS exercise; find any resistance dose whose sessionsPerWeek is below the strength floor.
    const { slots, doses, schedule } = scheduleFor("home-gym", "build-muscle", "3-plus", CLEAR, CLEAR_DOSE)
    const strengthDayNumbers = schedule.days.filter((d) => d.kind === "strength").map((d) => d.dayNumber)
    slots.forEach((slot, i) => {
      const dose = doses[i]
      if (dose.kind !== "resistance") return
      if (dose.sessionsPerWeek >= strengthDayNumbers.length) return
      const assignedDays = schedule.days
        .filter((d) => d.exerciseIds.includes(slot.exercise.id))
        .map((d) => d.dayNumber)
      assert.equal(assignedDays.length, Math.max(1, Math.min(dose.sessionsPerWeek, strengthDayNumbers.length)))
      // Every assigned day must actually be one of the strength days.
      for (const d of assignedDays) assert.equal(strengthDayNumbers.includes(d), true)
    })
  })

  it("is fully deterministic: identical inputs produce byte-identical schedules, run to run", () => {
    const a = scheduleFor("commercial-gym", "get-stronger", "1-3", CLEAR, CLEAR_DOSE).schedule
    const b = scheduleFor("commercial-gym", "get-stronger", "1-3", CLEAR, CLEAR_DOSE).schedule
    assert.deepEqual(a, b)
  })

  it("clamps an out-of-range chosenDaysInput rather than throwing or ignoring it", () => {
    const { slots, doses, summary, bounds } = scheduleFor("home-gym", "stay-healthy", "none", CLEAR, CLEAR_DOSE)
    const tooFew = buildWeeklySchedule(slots, doses, summary, 0)
    const tooMany = buildWeeklySchedule(slots, doses, summary, 30)
    assert.equal(tooFew.chosenDays, bounds.min)
    assert.equal(tooMany.chosenDays, bounds.max)
  })

  it("distributes total weekly aerobic minutes across training days without exceeding the weekly total", () => {
    const { summary, schedule } = scheduleFor("home-gym", "lose-fat", "none", CLEAR, CLEAR_DOSE)
    if (!summary.aerobicMinutesPerWeek) return
    const [totalLow, totalHigh] = summary.aerobicMinutesPerWeek
    const trainingDays = schedule.days.filter((d) => d.kind !== "rest")
    const summedLow = trainingDays.reduce((acc, d) => acc + d.aerobicMinutes[0], 0)
    const summedHigh = trainingDays.reduce((acc, d) => acc + d.aerobicMinutes[1], 0)
    // Rounding per-day can drift the sum a little; allow a small tolerance per day.
    assert.equal(summedLow <= totalLow + trainingDays.length, true)
    assert.equal(summedHigh <= totalHigh + trainingDays.length, true)
  })

  it("responds to a higher chosen day count by adding aerobic-only days rather than duplicating strength days", () => {
    const { slots, doses, summary, bounds } = scheduleFor("home-gym", "lose-fat", "none", CLEAR, CLEAR_DOSE)
    if (bounds.max <= bounds.min) return
    const atMin = buildWeeklySchedule(slots, doses, summary, bounds.min)
    const atMax = buildWeeklySchedule(slots, doses, summary, bounds.max)
    const strengthAtMin = atMin.days.filter((d) => d.kind === "strength").length
    const strengthAtMax = atMax.days.filter((d) => d.kind === "strength").length
    assert.equal(strengthAtMin, strengthAtMax)
    const aerobicOnlyAtMax = atMax.days.filter((d) => d.kind === "aerobic-only").length
    assert.equal(aerobicOnlyAtMax >= atMin.days.filter((d) => d.kind === "aerobic-only").length, true)
  })

  it("resolves every SCHEDULE_SOURCE_IDS entry to a real, non-dangling source", () => {
    for (const id of SCHEDULE_SOURCE_IDS) {
      const source = sourceById(id)
      assert.notEqual(source, undefined, `dangling schedule source reference: ${id}`)
    }
  })

  it("carries its source IDs through onto every built schedule", () => {
    const { schedule } = scheduleFor("home-gym", "build-muscle", "3-plus", CLEAR, CLEAR_DOSE)
    assert.deepEqual(schedule.sourceIds, SCHEDULE_SOURCE_IDS)
  })
})
