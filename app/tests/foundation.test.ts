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
})
