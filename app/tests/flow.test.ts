/**
 * What the required path has to be true of.
 *
 * These are here because the failure they guard against is silent. A flow that
 * asks one question too many looks fine; a flow that lets somebody past a
 * safety group without answering it also looks fine. Neither shows up in a type
 * check and neither shows up on screen. So the rules are pulled out of the
 * components into lib/flow.ts, and asserted here.
 *
 * Run with: npm test
 */

import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

import {
  DATA_STAGES,
  STAGES,
  bodyComplete,
  bodyMetrics,
  goalComplete,
  goalFields,
  groupAnswered,
  missingBodyMetrics,
  nextStage,
  previousStage,
  requiredBodyMetrics,
  safetyComplete,
} from "../src/lib/flow.ts"
import type { BodyValues, GoalState } from "../src/lib/flow.ts"
import { READINESS, SCOFF_QUESTIONS, SCOFF_TAGS, readinessItems } from "../src/lib/screening.ts"
import { assess, planFlags } from "../src/lib/goals.ts"
import type { Intent } from "../src/lib/goals.ts"
import type { Profile } from "../src/lib/calc.ts"

const FULL: BodyValues = { age: 27, height: 170, weight: 70, waist: 84, neck: 37, hip: 95 }

const PROFILE: Profile = {
  age: 27,
  sex: "male",
  ancestry: "unsaid",
  heightCm: 175,
  weightKg: 80,
  waistCm: 92,
  neckCm: 38,
  hipCm: 0,
}

describe("the shape of the flow", () => {
  it("has three data moments and nothing else", () => {
    assert.deepEqual([...DATA_STAGES], ["body", "safety", "goal"])
    assert.deepEqual(STAGES, ["intro", "body", "safety", "goal", "result"])
  })

  it("goes straight from the goal to the read, with no stage in between", () => {
    assert.equal(nextStage("goal"), "result")
    assert.equal(previousStage("result"), "goal")
  })

  it("does not walk off either end", () => {
    assert.equal(previousStage("intro"), "intro")
    assert.equal(nextStage("result"), "result")
  })
})

describe("the body asks only for what changes a number", () => {
  it("asks a man for six things and a woman for seven", () => {
    assert.deepEqual(bodyMetrics("male"), ["sex", "age", "height", "weight", "waist", "neck"])
    assert.deepEqual(bodyMetrics("female"), ["sex", "age", "height", "weight", "waist", "neck", "hip"])
  })

  it("asks for the hip only where the formula uses it", () => {
    assert.equal(requiredBodyMetrics("male").includes("hip"), false)
    assert.equal(requiredBodyMetrics("female").includes("hip"), true)
  })

  it("does not ask for ancestry, shoulders, muscle or appearance at all", () => {
    const asked = new Set<string>(bodyMetrics("female"))
    for (const gone of ["ancestry", "shoulder", "muscle", "skin", "hair", "facial", "photo"]) {
      assert.equal(asked.has(gone), false, `${gone} is still being asked for`)
    }
  })

  it("is complete for a man without a hip measurement, and not for a woman", () => {
    const noHip: BodyValues = { age: 27, height: 170, weight: 70, waist: 84, neck: 37 }
    assert.equal(bodyComplete("male", noHip), true)
    assert.equal(bodyComplete("female", noHip), false)
    assert.equal(bodyComplete("female", FULL), true)
  })

  it("names what is still missing rather than only refusing", () => {
    assert.deepEqual(missingBodyMetrics("male", { age: 27, height: 170 }), ["weight", "waist", "neck"])
    assert.deepEqual(missingBodyMetrics("male", FULL), [])
  })

  it("treats an untouched reading as missing, never as a default", () => {
    assert.equal(bodyComplete("male", {}), false)
  })
})

describe("safety is answered explicitly or not at all", () => {
  it("does not accept an untouched group as a no", () => {
    assert.equal(groupAnswered({ selected: 0, none: false }), false)
  })

  it("accepts a group that ticked something, and one that said none", () => {
    assert.equal(groupAnswered({ selected: 2, none: false }), true)
    assert.equal(groupAnswered({ selected: 0, none: true }), true)
  })

  it("needs both groups before the flow moves", () => {
    const answered = { selected: 0, none: true }
    const untouched = { selected: 0, none: false }
    assert.equal(safetyComplete(answered, untouched), false)
    assert.equal(safetyComplete(untouched, answered), false)
    assert.equal(safetyComplete(answered, answered), true)
  })

  it("still carries every screening item it is required to", () => {
    // PAR-Q style red flags, pregnancy, and the five SCOFF questions.
    const ids = READINESS.map((r) => r.id)
    for (const required of [
      "chestPain",
      "faintness",
      "supervisedOnly",
      "heartOrBp",
      "chronic",
      "jointProblem",
      "pregnant",
    ]) {
      assert.equal(ids.includes(required as never), true, `${required} is missing from the screen`)
    }
    assert.equal(SCOFF_QUESTIONS.length, 5)
    assert.equal(SCOFF_TAGS.length, SCOFF_QUESTIONS.length)
  })

  it("asks about pregnancy only where it can apply", () => {
    assert.equal(readinessItems("male").some((r) => r.id === "pregnant"), false)
    assert.equal(readinessItems("female").some((r) => r.id === "pregnant"), true)
  })
})

describe("the goal asks only what its own goal uses", () => {
  const base: GoalState = {
    kind: null,
    targetWeightKg: null,
    weeks: null,
    trainingAge: null,
    place: "gym",
    focus: ["chest"],
  }

  it("wants a target and a timeline for the two weight goals only", () => {
    assert.deepEqual(goalFields("lose-fat"), { target: true, timeline: true, trainingAge: false })
    assert.deepEqual(goalFields("build-muscle"), { target: true, timeline: true, trainingAge: true })
    assert.deepEqual(goalFields("get-stronger"), { target: false, timeline: false, trainingAge: false })
    assert.deepEqual(goalFields("stay-healthy"), { target: false, timeline: false, trainingAge: false })
  })

  it("lets stay-healthy and get-stronger through with no target, time or training age", () => {
    assert.equal(goalComplete({ ...base, kind: "stay-healthy" }), true)
    assert.equal(goalComplete({ ...base, kind: "get-stronger" }), true)
  })

  it("holds fat loss until there is both a target and a timeline", () => {
    assert.equal(goalComplete({ ...base, kind: "lose-fat" }), false)
    assert.equal(goalComplete({ ...base, kind: "lose-fat", targetWeightKg: 72 }), false)
    assert.equal(goalComplete({ ...base, kind: "lose-fat", targetWeightKg: 72, weeks: 12 }), true)
  })

  it("holds muscle gain until training age is given, because it sets the rate", () => {
    const muscle: GoalState = { ...base, kind: "build-muscle", targetWeightKg: 84, weeks: 26 }
    assert.equal(goalComplete(muscle), false)
    assert.equal(goalComplete({ ...muscle, trainingAge: "1-3" }), true)
  })

  it("always needs somewhere to train and something to train", () => {
    const ok: GoalState = { ...base, kind: "stay-healthy" }
    assert.equal(goalComplete({ ...ok, place: null }), false)
    assert.equal(goalComplete({ ...ok, focus: [] }), false)
  })
})

describe("nothing that was not asked turns into a warning", () => {
  it("raises no plan flags when effort and days a week were never collected", () => {
    const intent: Intent = { kind: "lose-fat", targetWeightKg: 74, weeks: 12 }
    assert.deepEqual(planFlags(intent), [])
  })

  it("still flags a short timeline, which is collected", () => {
    const intent: Intent = { kind: "lose-fat", targetWeightKg: 78, weeks: 6 }
    const flags = planFlags(intent)
    assert.equal(flags.length, 1)
    assert.match(flags[0].title, /eight weeks/)
  })

  it("still flags effort and frequency if something ever supplies them", () => {
    const intent: Intent = { kind: "build-muscle", weeks: 26, daysPerWeek: 2, effort: "comfortable" }
    assert.equal(planFlags(intent).length, 2)
  })

  it("assesses the two goals that need no timeline without inventing one", () => {
    for (const kind of ["stay-healthy", "get-stronger"] as const) {
      const out = assess(PROFILE, { kind }, 22)
      assert.equal(out.verdict, "realistic")
      assert.deepEqual(out.flags, [])
    }
  })

  it("says so rather than guessing when a rate has no denominator", () => {
    const out = assess(PROFILE, { kind: "lose-fat", targetWeightKg: 70 }, 22)
    assert.match(out.headline, /No timeline/)
  })

  it("still paces a fat loss goal that has both halves", () => {
    const out = assess(PROFILE, { kind: "lose-fat", targetWeightKg: 70, weeks: 4 }, 25)
    assert.equal(out.verdict, "impossible")
    assert.equal(typeof out.honestWeeks, "number")
  })
})
