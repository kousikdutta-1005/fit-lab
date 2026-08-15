import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

import { BALANCE_OVERLAY_AGE, EMPHASIS_CAPACITIES, buildFoundation } from "../src/lib/foundation.ts"
import type { SafetyContext } from "../src/lib/foundation.ts"
import { EMPHASIS_SLOT_CAP, REQUIRED_CAPACITIES } from "../src/data/capacities.ts"
import type { Place } from "../src/data/exercises.ts"

const PLACES: Place[] = ["home-gym", "commercial-gym"]

function ctx(overrides: Partial<SafetyContext> = {}): SafetyContext {
  return { screenKind: "clear", conditions: [], jointProblem: false, pregnant: false, age: 30, ...overrides }
}

describe("automatic foundation coverage", () => {
  it("covers every required capacity exactly once, for both environments, with no muscle-picking input", () => {
    for (const place of PLACES) {
      const slots = buildFoundation(place, ctx())
      const covered = slots.filter((s) => !s.optional).map((s) => s.capacity)
      for (const capacity of REQUIRED_CAPACITIES) {
        assert.equal(covered.filter((c) => c === capacity).length, 1, `capacity "${capacity}" should appear exactly once`)
      }
    }
  })

  it("never produces a duplicate movement slot", () => {
    for (const place of PLACES) {
      const slots = buildFoundation(place, ctx({ age: 70 }), "running")
      const capacities = slots.map((s) => s.capacity)
      assert.equal(new Set(capacities).size, capacities.length)
    }
  })

  it("is deterministic: identical inputs always produce the identical foundation", () => {
    const a = buildFoundation("home-gym", ctx(), "boxing")
    const b = buildFoundation("home-gym", ctx(), "boxing")
    assert.deepEqual(
      a.map((s) => s.exercise.id),
      b.map((s) => s.exercise.id),
    )
  })

  it("only selects exercises available in the requested environment", () => {
    for (const place of PLACES) {
      const slots = buildFoundation(place, ctx())
      for (const slot of slots) assert.equal(slot.exercise.environments.includes(place), true)
    }
  })

  it("adds the balance capacity only at/above the documented age-65 overlay threshold", () => {
    const younger = buildFoundation("home-gym", ctx({ age: BALANCE_OVERLAY_AGE - 1 }))
    const older = buildFoundation("home-gym", ctx({ age: BALANCE_OVERLAY_AGE }))
    assert.equal(younger.some((s) => s.capacity === "balance"), false)
    assert.equal(older.some((s) => s.capacity === "balance"), true)
  })

  it("always includes mobility regardless of age", () => {
    const slots = buildFoundation("home-gym", ctx({ age: 20 }))
    assert.equal(slots.some((s) => s.capacity === "mobility"), true)
  })

  it("drops impact/jumping exercises under pregnancy or a flagged joint problem", () => {
    const withoutSafetyFlag = buildFoundation("home-gym", ctx(), "running")
    assert.equal(withoutSafetyFlag.some((s) => s.exercise.id === "run-strides"), true, "sanity: strides is normally offered")

    const pregnant = buildFoundation("home-gym", ctx({ pregnant: true }), "running")
    assert.equal(pregnant.some((s) => s.exercise.id === "run-strides"), false)
    for (const slot of pregnant) assert.equal(Boolean(slot.exercise.impact), false)

    const jointFlagged = buildFoundation("home-gym", ctx({ jointProblem: true }), "running")
    assert.equal(jointFlagged.some((s) => s.exercise.id === "run-strides"), false)
    for (const slot of jointFlagged) assert.equal(Boolean(slot.exercise.impact), false)
  })

  it("drops impact exercises for anyone with the knee-pain condition, even without the joint-problem flag", () => {
    const flagged = buildFoundation("home-gym", ctx({ conditions: ["knee-pain"] }), "running")
    assert.equal(flagged.some((s) => s.exercise.id === "run-strides"), false)
  })

  it("returns an empty foundation under a 'stop' safety verdict, never a generic plan overriding medical caution", () => {
    const slots = buildFoundation("home-gym", ctx({ screenKind: "stop" }))
    assert.deepEqual(slots, [])
  })

  it("still returns a full foundation under 'caution' — caution reduces dose, it never withholds the whole plan", () => {
    const slots = buildFoundation("home-gym", ctx({ screenKind: "caution" }))
    assert.equal(slots.length > 0, true)
  })

  it("adds no optional slots on the untouched 'general' default — inference-free by design", () => {
    const slots = buildFoundation("home-gym", ctx(), "general")
    assert.equal(slots.every((s) => !s.optional), true)
  })

  it("caps every non-general emphasis at the approved optional-slot limit", () => {
    for (const emphasis of Object.keys(EMPHASIS_CAPACITIES) as (keyof typeof EMPHASIS_CAPACITIES)[]) {
      const slots = buildFoundation("home-gym", ctx(), emphasis)
      const optional = slots.filter((s) => s.optional)
      assert.equal(optional.length <= EMPHASIS_SLOT_CAP, true, `emphasis "${emphasis}" added more than ${EMPHASIS_SLOT_CAP} optional slots`)
    }
  })

  it("only ever adds optional slots from that emphasis's own declared capacity list", () => {
    for (const [emphasis, capacities] of Object.entries(EMPHASIS_CAPACITIES)) {
      const slots = buildFoundation("home-gym", ctx(), emphasis as keyof typeof EMPHASIS_CAPACITIES)
      for (const slot of slots.filter((s) => s.optional)) {
        assert.equal(capacities.includes(slot.capacity), true)
      }
    }
  })

  it("ranks S-tier, established-certainty exercises ahead of lower tier/certainty ones", () => {
    const slots = buildFoundation("home-gym", ctx())
    const squat = slots.find((s) => s.capacity === "knee_extension")
    assert.equal(squat?.exercise.tier, "S")
  })

  it("adds floor_transfer only at/above the age-65 overlay, alongside balance, never below it", () => {
    const younger = buildFoundation("home-gym", ctx({ age: BALANCE_OVERLAY_AGE - 1 }))
    const older = buildFoundation("home-gym", ctx({ age: BALANCE_OVERLAY_AGE }))
    assert.equal(younger.some((s) => s.capacity === "floor_transfer"), false)
    assert.equal(older.some((s) => s.capacity === "floor_transfer"), true)
  })

  it("covers the new universal arm and lumbar-extension capacities exactly once, for both environments", () => {
    for (const place of PLACES) {
      const slots = buildFoundation(place, ctx())
      for (const capacity of ["elbow_flexion", "elbow_extension", "lumbar_extension"] as const) {
        assert.equal(slots.filter((s) => s.capacity === capacity).length, 1, `capacity "${capacity}" should appear exactly once`)
      }
    }
  })

  it("flags the home lumbar-extension substitute as uncertain and cites the home ceiling; the commercial pick is not flagged uncertain", () => {
    const home = buildFoundation("home-gym", ctx()).find((s) => s.capacity === "lumbar_extension")
    const commercial = buildFoundation("commercial-gym", ctx()).find((s) => s.capacity === "lumbar_extension")
    assert.equal(home?.exercise.uncertain, true)
    assert.equal(Boolean(home?.exercise.homeCeilingId), true)
    assert.equal(Boolean(commercial?.exercise.uncertain), false)
  })

  it("never double-adds a capacity the emphasis shares with the age-65 overlay (yoga's 'balance')", () => {
    const slots = buildFoundation("home-gym", ctx({ age: BALANCE_OVERLAY_AGE }), "yoga")
    assert.equal(slots.filter((s) => s.capacity === "balance").length, 1)
  })

  it("yoga emphasis under age 65 still adds a balance slot, plus the yoga session, without exceeding the slot cap", () => {
    const slots = buildFoundation("home-gym", ctx({ age: 30 }), "yoga")
    assert.equal(slots.some((s) => s.capacity === "balance"), true)
    assert.equal(slots.some((s) => s.capacity === "yoga_session"), true)
    assert.equal(slots.filter((s) => s.optional).length <= EMPHASIS_SLOT_CAP, true)
  })

  it("calisthenics emphasis adds bodyweight push/pull/squat progressions alongside, not instead of, the standard required picks", () => {
    const slots = buildFoundation("home-gym", ctx(), "calisthenics")
    assert.equal(slots.some((s) => s.capacity === "horizontal_push" && !s.optional), true, "standard horizontal_push pick still present")
    assert.equal(slots.some((s) => s.capacity === "calisthenics_push" && s.optional), true)
    assert.equal(slots.some((s) => s.capacity === "calisthenics_pull" && s.optional), true)
    assert.equal(slots.some((s) => s.capacity === "calisthenics_squat" && s.optional), true)
  })
})
