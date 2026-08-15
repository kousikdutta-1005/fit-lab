import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

import {
  SETS_PER_EXERCISE_FLOOR,
  WEEKLY_SETS_PER_MUSCLE_CAP,
  applyWeeklyVolumeCap,
  doseForSlot,
  sessionsPerWeekForGoal,
  weeklySummary,
} from "../src/lib/dose.ts"
import type { Dose, ResistanceDose, SafetyDoseContext } from "../src/lib/dose.ts"
import { buildFoundation } from "../src/lib/foundation.ts"
import type { FoundationSlot, SafetyContext } from "../src/lib/foundation.ts"
import { exerciseById } from "../src/data/exercises.ts"
import type { Place } from "../src/data/exercises.ts"
import { capacityById } from "../src/data/capacities.ts"
import type { MuscleId } from "../src/data/exercises.ts"
import type { GoalKind, TrainingAge } from "../src/lib/goals.ts"

const CLEAR: SafetyDoseContext = { screenKind: "clear", age: 30 }
const GOALS: GoalKind[] = ["stay-healthy", "lose-fat", "build-muscle", "get-stronger"]
const TRAINING_AGES: TrainingAge[] = ["none", "under-1", "1-3", "3-plus"]

function slotFor(exerciseId: string): FoundationSlot {
  const exercise = exerciseById(exerciseId)
  if (!exercise) throw new Error(`fixture exercise "${exerciseId}" not found`)
  return { capacity: exercise.capacity, exercise, optional: false }
}

describe("goal-specific dosage", () => {
  it("produces a resistance dose for every goal x training-age combination without throwing, and never below the floor", () => {
    const slot = slotFor("squat-home")
    for (const goal of GOALS) {
      for (const trainingAge of TRAINING_AGES) {
        const dose = doseForSlot(slot, goal, trainingAge, CLEAR)
        assert.equal(dose.kind, "resistance")
        const r = dose as ResistanceDose
        assert.equal(r.sets >= SETS_PER_EXERCISE_FLOOR, true)
        assert.equal(r.repsLow <= r.repsHigh, true)
        assert.equal(r.restSeconds[0] <= r.restSeconds[1], true)
        assert.equal(r.rir[0] <= r.rir[1], true)
        assert.equal(r.sessionsPerWeek > 0, true)
      }
    }
  })

  it("treats an unanswered training age (undefined) the same as the most conservative 'none' lane -- never throws, never invents data", () => {
    const slot = slotFor("squat-home")
    const withUndefined = doseForSlot(slot, "build-muscle", undefined, CLEAR) as ResistanceDose
    const withNone = doseForSlot(slot, "build-muscle", "none", CLEAR) as ResistanceDose
    assert.deepEqual(withUndefined, withNone)
  })

  it("defaults resistance work to 2-3 RIR, never prescribing training to failure, under a clear screen", () => {
    const slot = slotFor("squat-home")
    for (const goal of GOALS) {
      const dose = doseForSlot(slot, goal, "1-3", CLEAR) as ResistanceDose
      assert.deepEqual(dose.rir, [2, 3])
    }
  })

  it("scales muscle-gain volume with training age (more experience -> more weekly sets), per ACSM guidance", () => {
    const slot = slotFor("squat-home")
    const novice = doseForSlot(slot, "build-muscle", "none", CLEAR) as ResistanceDose
    const intermediate = doseForSlot(slot, "build-muscle", "1-3", CLEAR) as ResistanceDose
    const advanced = doseForSlot(slot, "build-muscle", "3-plus", CLEAR) as ResistanceDose
    assert.equal(novice.sets <= intermediate.sets, true)
    assert.equal(intermediate.sets <= advanced.sets, true)
  })

  it("separates training days from per-exercise frequency so split exercises stay at two exposures", () => {
    const slot = slotFor("squat-home")
    const expectedTrainingDays: Record<TrainingAge, number> = {
      none: 2,
      "under-1": 2,
      "1-3": 3,
      "3-plus": 4,
    }
    for (const trainingAge of TRAINING_AGES) {
      const dose = doseForSlot(slot, "build-muscle", trainingAge, CLEAR) as ResistanceDose
      assert.equal(sessionsPerWeekForGoal("build-muscle", trainingAge), expectedTrainingDays[trainingAge])
      assert.equal(dose.sessionsPerWeek, 2)
      assert.equal(dose.sets <= 4, true)
    }
  })

  it("never requires training to failure and always attaches the double-progression rule", () => {
    const slot = slotFor("squat-home")
    const dose = doseForSlot(slot, "get-stronger", "3-plus", CLEAR) as ResistanceDose
    assert.match(dose.progression, /double progression/i)
    assert.equal(dose.rir[0] > 0, true)
  })

  it("reduces intensity/volume under a caution safety verdict rather than a generic plan overriding it", () => {
    const slot = slotFor("squat-home")
    const caution: SafetyDoseContext = { screenKind: "caution", age: 30 }
    const clearDose = doseForSlot(slot, "build-muscle", "3-plus", CLEAR) as ResistanceDose
    const cautionDose = doseForSlot(slot, "build-muscle", "3-plus", caution) as ResistanceDose
    assert.equal(cautionDose.sets <= clearDose.sets, true)
    assert.deepEqual(cautionDose.rir, [3, 4])
    assert.equal(cautionDose.sets >= SETS_PER_EXERCISE_FLOOR, true)
  })

  it("ramps high-DOMS exercises to a low starting volume regardless of goal, capped at 2 sessions/week", () => {
    const slot = slotFor("nordic-curl-home")
    assert.equal(slot.exercise.highDoms, true)
    for (const goal of GOALS) {
      const dose = doseForSlot(slot, goal, "3-plus", CLEAR) as ResistanceDose
      assert.equal(dose.sets, 1)
      assert.deepEqual([dose.repsLow, dose.repsHigh], [3, 6])
      assert.equal(dose.sessionsPerWeek <= 2, true)
      assert.match(dose.note ?? "", /delayed-onset soreness/i)
    }
  })

  it("scales the aerobic dose conservatively and prescribes more for lose-fat than stay-healthy", () => {
    const slot = slotFor("aerobic-base")
    const healthy = doseForSlot(slot, "stay-healthy", undefined, CLEAR)
    const fatLoss = doseForSlot(slot, "lose-fat", undefined, CLEAR)
    assert.equal(healthy.kind, "aerobic")
    assert.equal(fatLoss.kind, "aerobic")
    if (healthy.kind === "aerobic" && fatLoss.kind === "aerobic") {
      assert.equal(healthy.minutesPerWeek[1] <= 300, true)
      assert.equal(fatLoss.minutesPerWeek[0] >= healthy.minutesPerWeek[0], true)
    }
  })

  it("reduces aerobic minutes and interval rounds under caution too", () => {
    const aerobicSlot = slotFor("aerobic-base")
    const caution: SafetyDoseContext = { screenKind: "caution", age: 30 }
    const clear = doseForSlot(aerobicSlot, "stay-healthy", undefined, CLEAR)
    const cautioned = doseForSlot(aerobicSlot, "stay-healthy", undefined, caution)
    if (clear.kind === "aerobic" && cautioned.kind === "aerobic") {
      assert.equal(cautioned.minutesPerWeek[1] < clear.minutesPerWeek[1], true)
    }

    const intervalSlot = slotFor("run-strides")
    const clearInterval = doseForSlot(intervalSlot, "stay-healthy", undefined, CLEAR)
    const cautionInterval = doseForSlot(intervalSlot, "stay-healthy", undefined, caution)
    if (clearInterval.kind === "interval" && cautionInterval.kind === "interval") {
      assert.equal(cautionInterval.rounds[1] <= clearInterval.rounds[1], true)
    }
  })

  it("gives a referral-only dose (no sets/reps ever attached) for referral-role guides", () => {
    const slot = slotFor("outdoors-trip-prep")
    const dose = doseForSlot(slot, "stay-healthy", undefined, CLEAR)
    assert.equal(dose.kind, "referral")
    assert.equal("sets" in dose, false)
  })

  it("is a pure function: identical inputs always produce identical output", () => {
    const slot = slotFor("squat-home")
    const a = doseForSlot(slot, "build-muscle", "1-3", CLEAR)
    const b = doseForSlot(slot, "build-muscle", "1-3", CLEAR)
    assert.deepEqual(a, b)
  })
})

describe("weekly volume budget and deduplication", () => {
  it("caps overlapping same-region weekly volume without ever dropping a single exercise's sets below the floor", () => {
    const slots: FoundationSlot[] = [
      { capacity: "horizontal_pull", exercise: exerciseById("row-home")!, optional: false },
      { capacity: "vertical_pull", exercise: exerciseById("vertical-pull-home")!, optional: false },
      { capacity: "grip_carry", exercise: exerciseById("suitcase-carry")!, optional: false },
    ]
    const doses: Dose[] = [
      { kind: "resistance", sets: 10, repsLow: 8, repsHigh: 12, restSeconds: [90, 150], rir: [2, 3], sessionsPerWeek: 1, progression: "", sourceIds: [] },
      { kind: "resistance", sets: 10, repsLow: 8, repsHigh: 12, restSeconds: [90, 150], rir: [2, 3], sessionsPerWeek: 1, progression: "", sourceIds: [] },
      { kind: "resistance", sets: 10, repsLow: 8, repsHigh: 12, restSeconds: [90, 150], rir: [2, 3], sessionsPerWeek: 1, progression: "", sourceIds: [] },
    ]
    const { doses: capped, regionNotes } = applyWeeklyVolumeCap(slots, doses)
    const backTotal = capped.reduce((sum, d) => sum + (d.kind === "resistance" ? d.sets * d.sessionsPerWeek : 0), 0)
    assert.equal(backTotal <= WEEKLY_SETS_PER_MUSCLE_CAP, true)
    for (const d of capped) if (d.kind === "resistance") assert.equal(d.sets >= SETS_PER_EXERCISE_FLOOR, true)
    assert.equal(regionNotes.some((n) => n.includes("back")), true)
  })

  it("leaves volume untouched when a region is already within the weekly cap", () => {
    const slots: FoundationSlot[] = [{ capacity: "knee_extension", exercise: exerciseById("squat-home")!, optional: false }]
    const doses: Dose[] = [
      { kind: "resistance", sets: 3, repsLow: 8, repsHigh: 12, restSeconds: [90, 150], rir: [2, 3], sessionsPerWeek: 2, progression: "", sourceIds: [] },
    ]
    const { doses: capped, regionNotes } = applyWeeklyVolumeCap(slots, doses)
    assert.deepEqual(capped, doses)
    assert.deepEqual(regionNotes, [])
  })

  it("never touches abstract-capacity (aerobic/interval/referral) doses when capping resistance volume", () => {
    const slots = buildFoundation("home-gym", { screenKind: "clear", conditions: [], jointProblem: false, pregnant: false, age: 30 })
    const rawDoses = slots.map((s) => doseForSlot(s, "build-muscle", "3-plus", CLEAR))
    const { doses } = applyWeeklyVolumeCap(slots, rawDoses)
    const aerobicIndex = slots.findIndex((s) => s.capacity === "aerobic_base")
    assert.equal(doses[aerobicIndex].kind, "aerobic")
    assert.deepEqual(doses[aerobicIndex], rawDoses[aerobicIndex])
  })

  it("produces a weekly summary with a sane strength-session count, total set count and an aerobic minute range", () => {
    const slots = buildFoundation("home-gym", { screenKind: "clear", conditions: [], jointProblem: false, pregnant: false, age: 30 })
    const rawDoses = slots.map((s) => doseForSlot(s, "stay-healthy", undefined, CLEAR))
    const { doses } = applyWeeklyVolumeCap(slots, rawDoses)
    const summary = weeklySummary(slots, doses)
    assert.equal(summary.strengthSessionsPerWeek > 0, true)
    assert.equal(summary.totalWeeklySets > 0, true)
    assert.notEqual(summary.aerobicMinutesPerWeek, null)
    assert.equal(summary.notes.length > 0, true)
  })

  it("is deterministic across the whole pipeline: same profile inputs always produce the same weekly summary", () => {
    const build = () => {
      const slots = buildFoundation(
        "commercial-gym",
        { screenKind: "clear", conditions: [], jointProblem: false, pregnant: false, age: 40 },
        "running",
      )
      const rawDoses = slots.map((s) => doseForSlot(s, "lose-fat", undefined, CLEAR))
      const { doses } = applyWeeklyVolumeCap(slots, rawDoses)
      return weeklySummary(slots, doses)
    }
    assert.deepEqual(build(), build())
  })
})

describe("build-muscle weekly per-region hypertrophy volume", () => {
  const CTX: SafetyContext = { screenKind: "clear", conditions: [], jointProblem: false, pregnant: false, age: 30 }
  const PLACES: Place[] = ["home-gym", "commercial-gym"]

  function perRegionWeekly(place: Place, trainingAge: TrainingAge | undefined) {
    const slots = buildFoundation(place, CTX, "general")
    const rawDoses = slots.map((s) => doseForSlot(s, "build-muscle", trainingAge, CLEAR))
    const { doses } = applyWeeklyVolumeCap(slots, rawDoses)
    const byRegion = new Map<MuscleId, { weekly: number; anyHighDoms: boolean }>()
    slots.forEach((s, i) => {
      const d = doses[i]
      if (d.kind !== "resistance") return
      const anatomy = capacityById(s.capacity).anatomy
      if (!anatomy) return
      const entry = byRegion.get(anatomy) ?? { weekly: 0, anyHighDoms: false }
      entry.weekly += d.sets * d.sessionsPerWeek
      entry.anyHighDoms = entry.anyHighDoms || s.exercise.highDoms === true
      byRegion.set(anatomy, entry)
    })
    return byRegion
  }

  it("lands every non-high-DOMS region's weekly volume in a real hypertrophy range (>= 6 sets/week), not the bare maintenance floor, for every training age and environment", () => {
    for (const place of PLACES) {
      for (const trainingAge of ["none", "under-1", "1-3", "3-plus"] as TrainingAge[]) {
        const byRegion = perRegionWeekly(place, trainingAge)
        for (const [region, entry] of byRegion) {
          if (entry.anyHighDoms) continue // documented ramp exception: high-DOMS work starts low on purpose
          assert.equal(
            entry.weekly >= 6,
            true,
            `${place}/${trainingAge}/${region}: expected >=6 weekly sets, got ${entry.weekly}`,
          )
        }
      }
    }
  })

  it("increases (or holds) a single-exercise region's weekly volume monotonically as training age increases (the direct, undeduplicated read of the fix)", () => {
    for (const place of PLACES) {
      const none = perRegionWeekly(place, "none").get("quads")!.weekly
      const oneToThree = perRegionWeekly(place, "1-3").get("quads")!.weekly
      const threePlus = perRegionWeekly(place, "3-plus").get("quads")!.weekly
      assert.equal(none <= oneToThree, true, `${place}/quads: none -> 1-3 should not decrease`)
      assert.equal(oneToThree <= threePlus, true, `${place}/quads: 1-3 -> 3-plus should not decrease`)
    }
  })

  it("gives a true beginner (none/under-1) noticeably more than the bare 4-sets/week ACSM maintenance floor for a single-exercise region", () => {
    // quads is fed by exactly one capacity (knee_extension) in every environment, so its
    // weekly total is a direct read of the fix: sets-for-goal x sessions-for-goal.
    for (const place of PLACES) {
      for (const trainingAge of ["none", "under-1"] as TrainingAge[]) {
        const byRegion = perRegionWeekly(place, trainingAge)
        const quads = byRegion.get("quads")
        assert.notEqual(quads, undefined)
        assert.equal(quads!.weekly >= 6, true)
        assert.equal(quads!.weekly <= 8, true)
      }
    }
  })

  it("leaves stay-healthy resistance volume exactly at the ACSM maintenance floor (unchanged by the build-muscle fix)", () => {
    const slot: FoundationSlot = { capacity: "knee_extension", exercise: exerciseById("squat-home")!, optional: false }
    for (const trainingAge of ["none", "under-1", "1-3", "3-plus", undefined] as (TrainingAge | undefined)[]) {
      const dose = doseForSlot(slot, "stay-healthy", trainingAge, CLEAR) as ResistanceDose
      assert.equal(dose.sets, SETS_PER_EXERCISE_FLOOR)
      assert.equal(dose.sessionsPerWeek, 2)
    }
  })

  it("leaves lose-fat resistance volume unchanged by the build-muscle fix (compound 3 sets, isolation floor, 3 sessions/week)", () => {
    const compoundSlot: FoundationSlot = { capacity: "knee_extension", exercise: exerciseById("squat-home")!, optional: false }
    const isolationSlot: FoundationSlot = { capacity: "calf_soleus", exercise: exerciseById("calf-raise-home")!, optional: false }
    const compound = doseForSlot(compoundSlot, "lose-fat", "3-plus", CLEAR) as ResistanceDose
    const isolation = doseForSlot(isolationSlot, "lose-fat", "3-plus", CLEAR) as ResistanceDose
    assert.equal(compound.sets, 3)
    assert.equal(isolation.sets, SETS_PER_EXERCISE_FLOOR)
    assert.equal(compound.sessionsPerWeek, 3)
    assert.equal(isolation.sessionsPerWeek, 3)
  })
})
