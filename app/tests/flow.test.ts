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
  readinessSetChanged,
  requiredBodyMetrics,
  safetyComplete,
} from "../src/lib/flow.ts"
import type { BodyValues, GoalState } from "../src/lib/flow.ts"
import {
  READINESS,
  SCOFF_QUESTIONS,
  SCOFF_TAGS,
  applicableConditions,
  notesDefaultOpen,
  pruneConditions,
  readinessItems,
} from "../src/lib/screening.ts"
import { figureLabel } from "../src/lib/figure.ts"
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

describe("sex is answered, never assumed", () => {
  it("is not complete while sex is unanswered, however many readings are set", () => {
    assert.equal(bodyComplete(null, FULL), false)
    assert.equal(bodyComplete("male", FULL), true)
  })

  it("does not ask for a hip until sex is answered, and asks once it is female", () => {
    assert.equal(bodyMetrics(null).includes("hip"), false)
    assert.equal(requiredBodyMetrics(null).includes("hip"), false)
    assert.equal(requiredBodyMetrics("female").includes("hip"), true)

    // A woman who filled everything in before answering is still not complete,
    // and answering female puts the hip back on the list rather than skipping it.
    const noHip: BodyValues = { age: 27, height: 170, weight: 70, waist: 84, neck: 37 }
    assert.equal(bodyComplete(null, noHip), false)
    assert.equal(bodyComplete("female", noHip), false)
    assert.equal(bodyComplete("male", noHip), true)
  })

  it("does not ask about pregnancy until sex is answered", () => {
    assert.equal(readinessItems(null).some((r) => r.id === "pregnant"), false)
    assert.equal(readinessItems(null).length, readinessItems("male").length)
  })
})

describe("changing sex withdraws a safety confirmation it no longer covers", () => {
  it("is invalidated in both directions between male and female", () => {
    assert.equal(readinessSetChanged("male", "female"), true)
    assert.equal(readinessSetChanged("female", "male"), true)
  })

  it("is invalidated when sex is answered for the first time as female", () => {
    assert.equal(readinessSetChanged(null, "female"), true)
  })

  it("is not invalidated when the applicable questions are the same", () => {
    assert.equal(readinessSetChanged(null, "male"), false)
    assert.equal(readinessSetChanged("male", "male"), false)
    assert.equal(readinessSetChanged("female", "female"), false)
  })

  it("leaves the readiness group unanswered once the confirmation is withdrawn", () => {
    // A man says none of these apply, then corrects his sex to female. The
    // pregnancy question has never been shown to him, so the group has to go
    // back to unanswered rather than carry a yes or a no into the screen.
    const confirmedAsMale = { selected: 0, none: true }
    assert.equal(groupAnswered(confirmedAsMale), true)

    const withdrawn = readinessSetChanged("male", "female")
      ? { selected: 0, none: false }
      : confirmedAsMale
    assert.equal(groupAnswered(withdrawn), false)
    assert.equal(safetyComplete(withdrawn, { selected: 0, none: true }), false)
  })
})

describe("a target weight is set, not seeded", () => {
  const seeded: GoalState = {
    kind: "lose-fat",
    targetWeightKg: null,
    weeks: 12,
    trainingAge: null,
    place: "gym",
    focus: ["core"],
  }

  it("cannot complete a weight goal from a number nobody touched", () => {
    assert.equal(goalComplete(seeded), false)
    assert.equal(goalComplete({ ...seeded, targetWeightKg: 70 }), true)
  })

  it("holds muscle gain to the same rule", () => {
    const muscle: GoalState = { ...seeded, kind: "build-muscle", trainingAge: "none" }
    assert.equal(goalComplete(muscle), false)
    assert.equal(goalComplete({ ...muscle, targetWeightKg: 82 }), true)
  })

  it("still lets the goals with no target through", () => {
    assert.equal(goalComplete({ ...seeded, kind: "stay-healthy", weeks: null }), true)
  })
})

describe("conditions are offered by what was ticked, and dropped with it", () => {
  it("offers knee and back to somebody who ticked only a joint problem", () => {
    assert.deepEqual(applicableConditions(["jointProblem"]), ["knee-pain", "back-pain"])
  })

  it("offers nothing when nothing that opens them was ticked", () => {
    assert.deepEqual(applicableConditions([]), [])
    assert.deepEqual(applicableConditions(["chestPain", "faintness"]), [])
  })

  it("offers the medical list for a long-term condition and blood pressure alone for the heart question", () => {
    assert.deepEqual(applicableConditions(["heartOrBp"]), ["hypertension"])
    assert.deepEqual(applicableConditions(["chronic"]), [
      "type-2-diabetes",
      "hypertension",
      "pcos",
      "hypothyroid",
      "asthma",
    ])
  })

  it("keeps a condition that two answers open when only one is taken back", () => {
    assert.deepEqual(pruneConditions(["hypertension"], ["chronic"]), ["hypertension"])
    assert.deepEqual(pruneConditions(["hypertension"], ["heartOrBp"]), ["hypertension"])
  })

  it("drops a condition once every answer that opened it is gone", () => {
    assert.deepEqual(pruneConditions(["asthma", "knee-pain"], ["jointProblem"]), ["knee-pain"])
    assert.deepEqual(pruneConditions(["asthma", "knee-pain"], []), [])
  })
})

describe("screening notes are instructions, so they are shown", () => {
  it("is open on a caution, which is the screen that carries instructions", () => {
    assert.equal(notesDefaultOpen("caution"), true)
  })

  it("is open on a clear screen too, where the only note is the one about food", () => {
    assert.equal(notesDefaultOpen("clear"), true)
  })

  it("has nothing to open on a stop, which carries reasons rather than notes", () => {
    assert.equal(notesDefaultOpen("stop"), false)
  })
})

describe("the figure describes only what was entered", () => {
  it("says plainly that it is an illustration when it is one", () => {
    assert.match(figureLabel(null), /not drawn from your measurements/)
    assert.match(figureLabel({}), /have not entered any measurements/)
  })

  it("names a reading that was given and stays silent about one that was not", () => {
    const label = figureLabel({ heightCm: 172 })
    assert.match(label, /172 centimetres tall/)
    assert.equal(/kilograms/.test(label), false)
    assert.equal(/waist/.test(label), false)
  })

  it("never describes build, because nobody was asked for it", () => {
    for (const entered of [null, {}, { heightCm: 170, weightKg: 70, waistCm: 84, hipCm: 96 }]) {
      const label = figureLabel(entered)
      assert.equal(/built|muscular|muscle/.test(label), false, label)
    }
  })

  it("reads back everything once everything is given", () => {
    const label = figureLabel({ heightCm: 165, weightKg: 60, waistCm: 72, hipCm: 96 })
    for (const part of ["165 centimetres", "60 kilograms", "72 centimetres", "96 centimetres"]) {
      assert.match(label, new RegExp(part))
    }
  })
})
