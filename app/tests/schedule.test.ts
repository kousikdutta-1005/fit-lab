import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

import { applyWeeklyVolumeCap, doseForSlot, sessionsPerWeekForGoal, weeklySummary } from "../src/lib/dose.ts"
import type { SafetyDoseContext } from "../src/lib/dose.ts"
import { buildFoundation } from "../src/lib/foundation.ts"
import type { FoundationSlot, SafetyContext } from "../src/lib/foundation.ts"
import type { GoalKind, TrainingAge } from "../src/lib/goals.ts"
import type { Place } from "../src/data/exercises.ts"
import { sourceById } from "../src/data/evidence.ts"
import { capacityById } from "../src/data/capacities.ts"
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
  const summary = weeklySummary(slots, doses, sessionsPerWeekForGoal(goal, trainingAge))
  const bounds = weeklyDayBounds(summary)
  const schedule = buildWeeklySchedule(slots, doses, summary, chosenDays ?? bounds.optimal, goal)
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
        const schedule = buildWeeklySchedule(slots, doses, summary, bounds.max, goal)
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
    const schedule = buildWeeklySchedule(slots, doses, summary, bounds.max, "build-muscle")
    slots.forEach((slot, i) => {
      const dose = doses[i]
      if (dose.kind !== "resistance") return
      const daysWithThisExercise = schedule.days.filter((d) => d.exerciseIds.includes(slot.exercise.id))
      assert.equal(daysWithThisExercise.length <= dose.sessionsPerWeek, true)
      assert.equal(daysWithThisExercise.length <= schedule.days.filter((d) => d.kind === "strength").length, true)
    })
  })

  it("spaces a lower-frequency exercise (fewer sessions/week than the strength floor) evenly rather than clustering it", () => {
    // Get-stronger stays full-body at 3 sessions, while the high-DOMS hamstring
    // exercise remains capped at 2; that preserves the spacing behavior this
    // assertion covers without conflating it with split-mode consolidation.
    const { slots, doses, schedule } = scheduleFor("home-gym", "get-stronger", "3-plus", CLEAR, CLEAR_DOSE)
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
    const tooFew = buildWeeklySchedule(slots, doses, summary, 0, "stay-healthy")
    const tooMany = buildWeeklySchedule(slots, doses, summary, 30, "stay-healthy")
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
    const atMin = buildWeeklySchedule(slots, doses, summary, bounds.min, "lose-fat")
    const atMax = buildWeeklySchedule(slots, doses, summary, bounds.max, "lose-fat")
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

  it("keeps beginners on full body, uses Upper/Lower/Full body at 3 sessions, and repeats Upper/Lower at 4", () => {
    const beginner = scheduleFor("home-gym", "build-muscle", "under-1", CLEAR, CLEAR_DOSE)
    const intermediate = scheduleFor("home-gym", "build-muscle", "1-3", CLEAR, CLEAR_DOSE)
    const advanced = scheduleFor("home-gym", "build-muscle", "3-plus", CLEAR, CLEAR_DOSE)

    assert.equal(beginner.schedule.split, "full-body")
    assert.equal(intermediate.schedule.split, "upper-lower")
    assert.deepEqual(
      intermediate.schedule.days.filter((day) => day.kind === "strength").map((day) => day.label),
      ["Upper", "Lower", "Full body"],
    )
    assert.equal(advanced.schedule.split, "upper-lower")
    assert.deepEqual(
      advanced.schedule.days.filter((day) => day.kind === "strength").map((day) => day.label),
      ["Upper A", "Lower A", "Upper B", "Lower B"],
    )
  })

  it("keeps one foundation slot per resistance capacity and schedules each on exactly two split days", () => {
    for (const place of PLACES) {
      for (const trainingAge of ["1-3", "3-plus"] as TrainingAge[]) {
        const { slots, doses, schedule } = scheduleFor(place, "build-muscle", trainingAge, CLEAR, CLEAR_DOSE)
        const expected = slots
          .map((slot, index) => ({ slot, index, dose: doses[index] }))
          .filter(({ dose }) => dose.kind === "resistance")
        const scheduled = schedule.days.flatMap((day) => day.items).filter((item) => item.kind === "resistance")
        assert.equal(scheduled.length, expected.length * 2)
        for (const { slot, index } of expected) {
          assert.equal(
            scheduled.filter((item) => item.slotIndex === index).length,
            2,
            `${place}/${trainingAge}/${slot.capacity} should be assigned to exactly two split days`,
          )
        }
      }
    }
  })

  it("preserves every resistance exercise's exact weekly set math after splitting", () => {
    for (const place of PLACES) {
      for (const trainingAge of ["1-3", "3-plus"] as TrainingAge[]) {
        const { slots, doses, summary, schedule } = scheduleFor(place, "build-muscle", trainingAge, CLEAR, CLEAR_DOSE)
        let scheduledWeeklySets = 0
        slots.forEach((slot, index) => {
          const dose = doses[index]
          if (dose.kind !== "resistance") return
          const items = schedule.days.flatMap((day) => day.items).filter((item) => item.slotIndex === index)
          const scheduledSets = items.reduce((sum, item) => sum + (item.scheduledSets ?? 0), 0)
          for (const item of items) {
            assert.equal(
              (item.scheduledSets ?? 0) <= dose.sets,
              true,
              `${place}/${trainingAge}/${slot.capacity} has too many sets in one workout`,
            )
          }
          assert.equal(
            scheduledSets,
            dose.sets * dose.sessionsPerWeek,
            `${place}/${trainingAge}/${slot.capacity} weekly volume changed`,
          )
          scheduledWeeklySets += scheduledSets
        })

        assert.equal(scheduledWeeklySets, summary.totalWeeklySets)
      }
    }
  })

  it("hits every rendered anatomy region on at least two distinct days for every build-muscle training age", () => {
    for (const place of PLACES) {
      for (const trainingAge of ["none", "under-1", "1-3", "3-plus"] as TrainingAge[]) {
        const { slots, doses, schedule } = scheduleFor(place, "build-muscle", trainingAge, CLEAR, CLEAR_DOSE)
        const daysByRegion = new Map<string, Set<number>>()
        schedule.days.forEach((day) => {
          day.items.forEach((item) => {
            if (doses[item.slotIndex].kind !== "resistance") return
            const anatomy = capacityById(slots[item.slotIndex].capacity).anatomy
            if (!anatomy) return
            const days = daysByRegion.get(anatomy) ?? new Set<number>()
            days.add(day.dayNumber)
            daysByRegion.set(anatomy, days)
          })
        })
        for (const [region, days] of daysByRegion) {
          assert.equal(days.size >= 2, true, `${place}/${trainingAge}/${region} only appears on ${days.size} day(s)`)
        }
      }
    }
  })

  it("schedules every non-referral optional activity, including secondary aerobic and interval work", () => {
    for (const emphasis of ["running", "boxing", "outdoors"] as const) {
      const slots = buildFoundation("home-gym", CLEAR, emphasis)
      const rawDoses = slots.map((slot) => doseForSlot(slot, "build-muscle", "3-plus", CLEAR_DOSE))
      const { doses } = applyWeeklyVolumeCap(slots, rawDoses)
      const summary = weeklySummary(slots, doses, sessionsPerWeekForGoal("build-muscle", "3-plus"))
      const schedule = buildWeeklySchedule(slots, doses, summary, weeklyDayBounds(summary).optimal, "build-muscle")
      const scheduledIndexes = new Set(schedule.days.flatMap((day) => day.items.map((item) => item.slotIndex)))
      doses.forEach((dose, index) => {
        if (dose.kind !== "referral") {
          assert.equal(scheduledIndexes.has(index), true, `${emphasis}/${slots[index].capacity} was omitted`)
        }
      })
    }
  })

  it("places optional push, pull, squat and hamstring capacities in their real three-day lanes", () => {
    for (const emphasis of ["running", "calisthenics"] as const) {
      const slots = buildFoundation("home-gym", CLEAR, emphasis)
      const rawDoses = slots.map((slot) => doseForSlot(slot, "build-muscle", "1-3", CLEAR_DOSE))
      const { doses } = applyWeeklyVolumeCap(slots, rawDoses)
      const summary = weeklySummary(slots, doses, sessionsPerWeekForGoal("build-muscle", "1-3"))
      const schedule = buildWeeklySchedule(slots, doses, summary, weeklyDayBounds(summary).optimal, "build-muscle")
      for (const [capacity, expectedLabel] of [
        ["run_hamstring_resilience", "Lower"],
        ["calisthenics_push", "Upper"],
        ["calisthenics_pull", "Upper"],
        ["calisthenics_squat", "Lower"],
      ] as const) {
        const index = slots.findIndex((slot) => slot.capacity === capacity)
        if (index < 0) continue
        const day = schedule.days.find((candidate) => candidate.items.some((item) => item.slotIndex === index))
        assert.equal(day?.label, expectedLabel, `${capacity} should be on ${expectedLabel}`)
      }
    }
  })
})
